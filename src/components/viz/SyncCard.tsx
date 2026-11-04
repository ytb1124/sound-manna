// 화면-소리 맞추기(구성안 7.4의 3번). 30초 카드, 모달 아님.
import { useCallback, useEffect, useRef, useState } from 'react';
import { engine, useAnimationFrame } from '../../audio/useEngine';
import { updateProfile, useProfile } from '../../store/profile';
import { Icon } from '../ui/Icon';
import { ko, tx } from '../../i18n';
import './viz.css';

const TAPS_NEEDED = 8;
const LIMIT = 300;
const clampMs = (v: number) => Math.max(-LIMIT, Math.min(LIMIT, Math.round(v / 10) * 10));

/** 그림 늦추기 값을 슬라이더 대신 정해진 단위(10·50 ms) 버튼으로 바꾼다. 지금 값은 초와 ms로 함께 보여 준다 */
export function OffsetStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const shown = value === 0
    ? tx('그림과 소리를 그대로 맞춰요 (0 ms)', 'No adjustment (0 ms)')
    : value > 0
      ? tx(ko`그림을 ${(value / 1000).toFixed(2)}초 늦춰요 (+${value} ms)`, `Pictures ${(value / 1000).toFixed(2)} s later (+${value} ms)`)
      : tx(ko`그림을 ${(-value / 1000).toFixed(2)}초 앞당겨요 (${value} ms)`, `Pictures ${(-value / 1000).toFixed(2)} s earlier (${value} ms)`);
  const steps: [number, string][] = [
    [-50, tx('그림 많이 앞당기기 −50', 'Much earlier −50')],
    [-10, tx('조금 앞당기기 −10', 'A bit earlier −10')],
    [10, tx('조금 늦추기 +10', 'A bit later +10')],
    [50, tx('그림 많이 늦추기 +50', 'Much later +50')],
  ];
  return (
    <div className="stack" role="group" aria-label={label}>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--body-strong)' }}>{label}</p>
      <p style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">{shown}</p>
      <div className="row">
        {steps.map(([d, l]) => (
          <button key={d} type="button" className="btn btn-sm" disabled={d < 0 ? value <= -LIMIT : value >= LIMIT} onClick={() => onChange(clampMs(value + d))}>
            {l}
          </button>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{tx('그림이 소리보다 먼저 움직이면 [늦추기], 소리보다 늦게 움직이면 [앞당기기]를 눌러요. 한 번에 0.01초(10 ms) 또는 0.05초(50 ms)씩 바뀌어요.', 'If pictures move before the sound, press [later]. If they move after it, press [earlier]. Each press changes 0.01 s (10 ms) or 0.05 s (50 ms).')}</p>
    </div>
  );
}

export function SyncCard({ onClose }: { onClose: () => void }) {
  const profile = useProfile();
  const initial = useRef(profile.sync);
  const [val, setVal] = useState(profile.sync.userOffsetMs);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const lastOn = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(!!engine.ctx);
  const [errs, setErrs] = useState<number[]>([]);
  const tapping = errs.length < TAPS_NEEDED;

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const f = () => setReduced(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);

  useEffect(() => {
    if (engine.ctx) {
      engine.startSyncClicks(0.6);
      setReady(true);
    }
    return () => engine.stopSyncClicks();
  }, []);

  useAnimationFrame(() => {
    const ph = engine.syncPhase();
    const on = ph !== null && ph < 0.08;
    if (on !== lastOn.current) {
      lastOn.current = on;
      dot.current?.classList.toggle('is-on', on);
      if (label.current) label.current.textContent = on ? tx('지금', 'Now') : '';
    }
  }, true);

  // 소리가 들릴 때마다 누른 순간 → 앞의 두 번을 빼고 가운데 값(중앙값)으로 늦출 양을 정한다
  const tap = () => {
    const e = engine.syncTapError();
    if (e === null) return;
    const next = [...errs, e];
    setErrs(next);
    if (next.length === TAPS_NEEDED) {
      const xs = next.slice(2).sort((a, b) => a - b);
      const mid = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
      change(clampMs(mid * 1000));
    }
  };

  const change = useCallback((v: number) => {
    setVal(v);
    updateProfile((p) => ({ sync: { ...p.sync, userOffsetMs: v, method: 'tap', calibratedAt: new Date().toISOString() } }));
  }, []);

  const close = (fn?: () => void) => {
    engine.stopSyncClicks();
    fn?.();
    onClose();
  };
  const save = () =>
    close(() => updateProfile((p) => ({ sync: { ...p.sync, userOffsetMs: val, method: 'tap', calibratedAt: new Date().toISOString() } })));
  const unsure = () => close(() => updateProfile((p) => ({ sync: { ...p.sync, userOffsetMs: 0, method: 'auto', calibratedAt: null } })));
  const cancel = () => close(() => updateProfile({ sync: initial.current }));

  const out = engine.latencyInfo().outputLatency;
  const btHint = profile.route === 'direct' && (out === null || out < 0.05);

  return (
    <div className="card viz-sync" role="group" aria-label={tx('화면과 소리 맞추기', 'Sync picture and sound')}>
      <div>
        <h3 style={{ margin: 0, letterSpacing: 0 }}>{tx('화면과 소리 맞추기', 'Sync picture and sound')}</h3>
        <p style={{ margin: '4px 0 0' }}>
          {tapping
            ? tx(ko`'탁' 소리가 들릴 때마다 아래 [들렸어요]를 눌러 주세요. 화면은 보지 말고 소리만 듣고 눌러요. (${errs.length} / ${TAPS_NEEDED})`, `Press [I heard it] each time you hear the 'tak' sound. Listen only; don't watch the screen. (${errs.length} / ${TAPS_NEEDED})`)
            : tx('누른 박자로 맞췄어요. 이제 동그라미가 깜빡이는 순간과 소리가 맞는지 보세요. 어긋나면 아래 버튼으로 조금씩 고쳐요.', 'Set from your taps. Now check that the circle flashes with the sound. If not, fix it a little with the buttons below.')}
        </p>
      </div>
      {!ready && <p className="muted" role="status">{tx('먼저 소리를 켜 주세요.', 'Please turn on the sound first.')}</p>}
      {tapping ? (
        <button type="button" className="btn btn-primary btn-lg btn-block" style={{ minHeight: 96 }} onClick={tap} disabled={!ready}>
          {tx('들렸어요', 'I heard it')}
        </button>
      ) : (
        <>
          <div className="viz-sync-stage" aria-hidden="true">
            <div ref={dot} className={`viz-sync-dot${reduced ? ' is-square' : ''}`}>
              <span ref={label} />
            </div>
          </div>
          <OffsetStepper label={tx('그림 늦추기', 'Picture delay')} value={val} onChange={change} />
        </>
      )}
      {btHint && <p className="viz-note" role="note">{tx('블루투스로 들으면 소리가 늦게 도착할 수 있어요.', 'With Bluetooth, the sound can arrive late.')}</p>}
      <div className="viz-sync-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={save} disabled={tapping}>
          <Icon name="check" />
          {tx('이대로 좋아요', 'Looks good')}
        </button>
        {!tapping && (
          <button type="button" className="btn btn-lg" onClick={() => setErrs([])}>
            <Icon name="refresh" />
            {tx('다시 누르기', 'Tap again')}
          </button>
        )}
        <button type="button" className="btn btn-lg" onClick={unsure}>
          {tx('잘 모르겠어요', 'Not sure')}
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={cancel}>
          {tx('닫기', 'Close')}
        </button>
      </div>
    </div>
  );
}
