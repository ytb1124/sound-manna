// 박자 따라 치기(리듬 놀이). 곡을 들으며 박자마다 버튼을 누르면, 누른 순간과 박자를 띠 위에 함께 보여 준다.
// 점수·정답 없이 "이번에 누른 경향"(조금 빨랐어요/늦었어요)만 알려 준다(설계 원칙 2, 3).
import { useCallback, useRef, useState } from 'react';
import { engine, useAnimationFrame, useEngineState } from '../../audio/useEngine';
import { beatSec, SONGS } from '../../config/songs';
import { readColors, useFitCanvas, type VizColors } from '../../components/viz/Lanes';
import { Icon } from '../../components/ui/Icon';
import { logEvent } from '../../store/log';
import type { InstrumentId, SongId } from '../../types';
import { ko, tx } from '../../i18n';

const BACK = 1.5; // 띠에 보이는 지난 시간(초)
const FWD = 3; // 앞으로 올 시간(초)
const MIN_TAPS = 8;
/** 이만큼(ms)보다 차이가 작으면 "거의 같았어요" */
const CLOSE_MS = 60;

export function BeatTap({ song, onSolo }: { song: SongId; onSolo: (id: InstrumentId) => void }) {
  const st = useEngineState();
  const cfg = SONGS[song];
  const bs = beatSec(cfg);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const taps = useRef<{ t: number; err: number }[]>([]);
  const [count, setCount] = useState(0);
  const [mean, setMean] = useState<number | null>(null);
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 96 : 110));
  const colors = useRef<VizColors | null>(null);
  const n = useRef(0);

  const nearestBeat = useCallback((t: number) => {
    const k = Math.round((t - cfg.startOffsetSec) / bs);
    return { k, at: cfg.startOffsetSec + k * bs };
  }, [cfg, bs]);

  const tap = () => {
    if (!st.playing) {
      engine.play();
      return;
    }
    const t = engine.songTime();
    const { at } = nearestBeat(t);
    taps.current = [...taps.current.filter((x) => Math.abs(x.t - t) < 30), { t, err: t - at }].slice(-40);
    const c = count + 1;
    setCount(c);
    if (c >= MIN_TAPS) {
      // 앞의 두 번은 박자를 찾는 중이라 빼고, 최근 16번으로 본다
      const recent = taps.current.slice(2).slice(-16);
      const m = (recent.reduce((a, x) => a + x.err, 0) / recent.length) * 1000;
      setMean(m);
      if (c === MIN_TAPS || c % 8 === 0) logEvent({ type: 'beattap', song, taps: c, meanMs: Math.round(m) });
    }
  };

  const reset = () => {
    taps.current = [];
    setCount(0);
    setMean(null);
  };

  const draw = useCallback(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    if (!colors.current || n.current++ % 45 === 0) colors.current = readColors(c);
    const col = colors.current;
    const { w, h, dpr } = size.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col.soft;
    g.fillRect(0, 0, w, h);
    const now = engine.songTime();
    const pps = w / (BACK + FWD);
    const px = BACK * pps;
    const xOf = (t: number) => px + (t - now) * pps;
    const mid = h * 0.42;
    // 박자: 마디 첫 박은 크게
    const k0 = Math.ceil((now - BACK - cfg.startOffsetSec) / bs);
    const k1 = Math.floor((now + FWD - cfg.startOffsetSec) / bs);
    for (let k = k0; k <= k1; k++) {
      const t = cfg.startOffsetSec + k * bs;
      const x = xOf(t);
      const down = ((k % cfg.meter) + cfg.meter) % cfg.meter === 0;
      g.fillStyle = t < now ? col.muted : col.lane.cajon;
      g.beginPath();
      g.arc(x, mid, down ? 11 : 7, 0, Math.PI * 2);
      g.fill();
    }
    // 누른 순간: 아래쪽 세로 막대
    g.fillStyle = col.ink;
    for (const tp of taps.current) {
      const x = xOf(tp.t);
      if (x < -4 || x > w + 4) continue;
      g.fillRect(x - 2, mid + 16, 4, h - mid - 22);
    }
    // 지금 선
    g.strokeStyle = col.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px, 4);
    g.lineTo(px, h - 4);
    g.stroke();
  }, [ref, size, cfg, bs]);
  useAnimationFrame(draw, open);

  const feel = mean === null
    ? null
    : Math.abs(mean) < CLOSE_MS
      ? tx('누른 순간이 박자와 거의 같았어요.', 'Your taps were almost on the beat.')
      : mean < 0
        ? tx(ko`누른 순간이 박자보다 조금 빨랐어요(평균 ${(-mean / 1000).toFixed(2)}초).`, `Your taps came a little early (about ${(-mean / 1000).toFixed(2)} s on average).`)
        : tx(ko`누른 순간이 박자보다 조금 늦었어요(평균 ${(mean / 1000).toFixed(2)}초).`, `Your taps came a little late (about ${(mean / 1000).toFixed(2)} s on average).`);

  return (
    <section className="card stack" aria-label={tx('박자 따라 치기', 'Tap along with the beat')}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="room-beat"
        onClick={() => setOpen(!open)}
        style={{ justifyContent: 'space-between' }}
      >
        <span>{tx('박자 따라 치기', 'Tap along with the beat')}</span>
        <Icon name="chevronDown" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div id="room-beat" className="stack">
          <button type="button" className="btn btn-sm" aria-expanded={help} onClick={() => setHelp(!help)} style={{ alignSelf: 'flex-start' }}>
            <Icon name="question" size={18} />
            {tx('박자와 리듬이 뭐예요?', 'What are beat and rhythm?')}
          </button>
          {help && (
            <div className="card card-soft stack" role="note">
              <p style={{ margin: 0 }}>
                <strong>{tx('박자', 'Beat')}</strong>{' '}
                {tx('음악 밑에 깔린 일정한 걸음이에요. 노래를 들으며 발을 까딱이게 되는 그 간격이에요. 빨라지거나 느려지지 않고 고르게 이어져요.', 'The steady step under the music. It is the gap you tap your foot to while listening. It stays even, not faster or slower.')}
              </p>
              <p style={{ margin: 0 }}>
                <strong>{tx('리듬', 'Rhythm')}</strong>{' '}
                {tx('소리가 길고 짧게 이어지는 무늬예요. 박자 위에 얹혀서, 한 박에 소리가 여러 번 나기도 하고 두 박 동안 하나가 길게 이어지기도 해요.', 'The pattern of long and short sounds. It sits on top of the beat: sometimes several sounds fall in one beat, sometimes one sound lasts two beats.')}
              </p>
              <p style={{ margin: 0 }}>
                {cfg.meter === 3
                  ? tx("이 곡은 '쿵-짝-짝' 세 박이 한 묶음이에요(3박자). 아래 띠에서 큰 동그라미가 묶음의 첫 박이에요.", "This song groups beats in threes: 'boom-tap-tap' (3/4 time). In the strip below, the big circle is the first beat of each group.")
                  : tx("이 곡은 '쿵-짝-쿵-짝' 네 박이 한 묶음이에요(4박자). 아래 띠에서 큰 동그라미가 묶음의 첫 박이에요.", "This song groups beats in fours: 'boom-tap-boom-tap' (4/4 time). In the strip below, the big circle is the first beat of each group.")}
              </p>
            </div>
          )}
          <p style={{ margin: 0 }}>
            {tx('곡을 들으며 동그라미가 세로선에 닿을 때마다 [탁]을 눌러 보세요. 누른 순간은 아래에 검은 막대로 남아요.', 'While listening, press [Tap] each time a circle reaches the vertical line. Each tap leaves a black bar below.')}
          </p>
          <div className="viz-canvas-box">
            <canvas
              ref={ref}
              className="viz-canvas"
              role="img"
              aria-label={tx('박자 띠. 동그라미는 박자, 큰 동그라미는 묶음의 첫 박, 검은 막대는 내가 누른 순간', 'Beat strip. Circles are beats, big circles start each group, black bars are your taps')}
            />
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={tap}>
            {st.playing ? tx('탁', 'Tap') : tx('곡 틀고 시작하기', 'Play and start')}
          </button>
          <p className="room-live" role="status" aria-live="polite" style={{ margin: 0 }}>
            {count === 0
              ? ''
              : count < MIN_TAPS
                ? tx(ko`${count}번 눌렀어요. ${MIN_TAPS - count}번 더 누르면 어땠는지 알려 드려요.`, `${count} taps. Tap ${MIN_TAPS - count} more times to see how it went.`)
                : feel}
          </p>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => onSolo('cajon')}>
              {tx('카혼만 켜기 (박자가 더 잘 들려요)', 'Cajon only (beat is easier to hear)')}
            </button>
            {count > 0 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={reset}>
                <Icon name="refresh" size={18} />
                {tx('다시 하기', 'Start over')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
