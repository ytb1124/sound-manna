// CI 보코더 시뮬레이션(청인 체험용). 고전적인 채널 보코더를 Web Audio 기본 노드로 만든다.
// 대역마다: 입력 → 대역통과(2단) → 전파 정류(|x|) → 저역통과 160 Hz(2단) = 포락선
//           반송파(잡음 대역 또는 대역 중심 사인) × 포락선 → 합
// 대역 경계는 Greenwood(1990) 달팽이관 위치-주파수 식에서 200–7000 Hz를 같은 간격으로 나눈다(Friesen 외 2001 등).
// 포락선 160 Hz는 Shannon 외(1995)를 따랐다. 실제 CI 소리와 닮은 정도는 낮다(Dorman 외 2017) — 화면에 꼭 밝힌다.

export type VocoderCarrier = 'noise' | 'sine';
export interface VocoderOptions {
  channels: number;
  carrier: VocoderCarrier;
}

const F_LO = 200;
const F_HI = 7000;
const ENV_HZ = 160;
// 포락선 = 평균 |x| ≈ 0.8 × RMS(가우스 근사). 반송파 RMS를 1로 맞추고 이만큼 되돌린다.
// 여기에 +2 dB: 200 Hz 아래·대역 사이에서 빠지는 에너지 보상(핑크노이즈·화음 입력으로 원음과 비교해 맞춤)
const ENV_MAKEUP = 1.25 * 1.26;
// 잡음 반송파는 등가 대역폭 근사가 조금 넓게 잡혀 사인보다 약 2 dB 작게 나온다
const NOISE_TRIM = 1.26;

// Greenwood(1990), 사람: f = 165.4 (10^(2.1 x) − 0.88), x = 꼭대기에서 잰 상대 위치(0–1)
const gw = (x: number) => 165.4 * (Math.pow(10, 2.1 * x) - 0.88);
const gwInv = (f: number) => Math.log10(f / 165.4 + 0.88) / 2.1;

export function bandEdges(n: number): [number, number][] {
  const x0 = gwInv(F_LO);
  const x1 = gwInv(F_HI);
  return Array.from({ length: n }, (_, i) => [gw(x0 + ((x1 - x0) * i) / n), gw(x0 + ((x1 - x0) * (i + 1)) / n)]);
}

let noiseCache: AudioBuffer | null = null;
function noiseBuffer(ctx: BaseAudioContext) {
  if (noiseCache && noiseCache.sampleRate === ctx.sampleRate) return noiseCache;
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // 가우스 잡음(RMS 1)
  for (let i = 0; i < len; i += 2) {
    const u = Math.random() || 1e-9;
    const r = Math.sqrt(-2 * Math.log(u));
    const a = 2 * Math.PI * Math.random();
    d[i] = r * Math.cos(a);
    if (i + 1 < len) d[i + 1] = r * Math.sin(a);
  }
  noiseCache = buf;
  return buf;
}

let absCurve: Float32Array<ArrayBuffer> | null = null;
function rectifier() {
  if (absCurve) return absCurve;
  const n = 4097;
  absCurve = new Float32Array(n);
  for (let i = 0; i < n; i++) absCurve[i] = Math.abs((i / (n - 1)) * 2 - 1);
  return absCurve;
}

/** 입력(input)에서 받아 출력(output)으로 보낸다. 다 쓰면 dispose() */
export class Vocoder {
  readonly input: GainNode;
  readonly output: GainNode;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];

  constructor(ctx: BaseAudioContext, opts: VocoderOptions) {
    this.input = new GainNode(ctx, { gain: 1 });
    this.output = new GainNode(ctx, { gain: ENV_MAKEUP });
    const noise = opts.carrier === 'noise' ? new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx), loop: true }) : null;
    if (noise) this.sources.push(noise);

    for (const [lo, hi] of bandEdges(opts.channels)) {
      const fc = Math.sqrt(lo * hi);
      const Q = fc / (hi - lo);
      const bp = () => new BiquadFilterNode(ctx, { type: 'bandpass', frequency: fc, Q });
      const lp = () => new BiquadFilterNode(ctx, { type: 'lowpass', frequency: ENV_HZ, Q: Math.SQRT1_2 });

      // 분석: 대역 → |x| → 저역통과 = 포락선
      const a1 = bp();
      const a2 = bp();
      const rect = new WaveShaperNode(ctx, { curve: rectifier() });
      const e1 = lp();
      const e2 = lp();
      this.input.connect(a1).connect(a2).connect(rect).connect(e1).connect(e2);

      // 합성: 반송파(RMS 1) × 포락선. gain 기본값 0에 포락선 신호를 더한다.
      const mod = new GainNode(ctx, { gain: 0 });
      e2.connect(mod.gain);
      if (noise) {
        // 2단 대역통과의 잡음 등가 대역폭 ≈ (π/4)·fc/Q. 잡음 RMS가 1이 되게 보상
        const enbw = (Math.PI / 4) * (fc / Q);
        const comp = new GainNode(ctx, { gain: NOISE_TRIM * Math.sqrt(ctx.sampleRate / 2 / enbw) });
        const c1 = bp();
        const c2 = bp();
        noise.connect(c1).connect(c2).connect(comp).connect(mod);
        this.nodes.push(c1, c2, comp);
      } else {
        const osc = new OscillatorNode(ctx, { type: 'sine', frequency: fc });
        const amp = new GainNode(ctx, { gain: Math.SQRT2 });
        osc.connect(amp).connect(mod);
        this.sources.push(osc);
        this.nodes.push(amp);
      }
      mod.connect(this.output);
      this.nodes.push(a1, a2, rect, e1, e2, mod);
    }
    for (const s of this.sources) s.start();
  }

  dispose() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* 이미 멈춤 */
      }
      s.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    this.input.disconnect();
    this.output.disconnect();
  }
}
