import { useState } from 'react';
import { engine, useEngineState } from '../../audio/useEngine';
import { Chip } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { updateProfile, useProfile } from '../../store/profile';
import { logEvent } from '../../store/log';
import type { BassAssist, SongId } from '../../types';
import { tx } from '../../i18n';

export function AdvancedPanel({
  song, blind, onBlind, onReveal, revealed,
}: {
  song: SongId; blind: boolean; onBlind: (v: boolean) => void; onReveal: () => void; revealed: boolean;
}) {
  const profile = useProfile();
  const st = useEngineState();
  const [open, setOpen] = useState(false);
  const saved = !!profile.songOverrides[song];
  const revert = () => {
    updateProfile((p) => {
      const so = { ...p.songOverrides };
      delete so[song];
      return { songOverrides: so };
    });
  };
  const assists: { v: BassAssist; label: string }[] = [
    { v: 'none', label: tx('원래 소리', 'Original sound') },
    { v: 'boost', label: tx('저음 키우기', 'Boost bass') },
    { v: 'octaveUp', label: tx('베이스를 높게 겹쳐 듣기', 'Add bass an octave up') },
  ];

  return (
    <section className="card stack" aria-label={tx('더 맞추기', 'More settings')}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="room-adv"
        onClick={() => setOpen(!open)}
        style={{ justifyContent: 'space-between' }}
      >
        <span>{tx('더 맞추기', 'More settings')}</span>
        <Icon name="chevronDown" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div id="room-adv" className="stack-lg">
          <div className="stack">
            <p className="small muted" style={{ margin: 0 }} role="status">
              {tx('악기 크기는 카드 아래 [−][+]로 바꿔요. 바꾼 크기는 이 곡에 바로 저장돼요.', 'Change instrument volume with [−][+] under each card. Changes are saved for this song right away.')}
            </p>
            {saved && (
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={revert}>
                  {tx('내 기본 설정으로 되돌리기', 'Back to my default settings')}
                </button>
              </div>
            )}
          </div>

          <div className="stack">
            <h3 style={{ margin: 0 }}>{tx('저음 도움', 'Bass help')}</h3>
            <div className="row" role="group" aria-label={tx('저음 도움', 'Bass help')}>
              {assists.map((a) => (
                <Chip key={a.v} pressed={profile.bassAssist === a.v} onClick={() => updateProfile({ bassAssist: a.v })}>
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <Chip pressed={profile.soloLoudnessMatch} onClick={() => updateProfile({ soloLoudnessMatch: !profile.soloLoudnessMatch })}>
              {tx('혼자 들어도 같은 크기로', 'Same volume when solo')}
            </Chip>
            <Chip pressed={st.bypass} onClick={() => engine.setBypass(!st.bypass)}>
              {tx('내 설정 끄고 비교하기', 'Compare without my settings')}
            </Chip>
            <Chip
              pressed={blind}
              onClick={() => {
                onBlind(!blind);
                logEvent({ type: 'blind', value: !blind ? 'on' : 'off' });
              }}
            >
              {tx('악기 이름 가리고 듣기', 'Hide instrument names')}
            </Chip>
            {blind && !revealed && (
              <button type="button" className="btn btn-sm" onClick={onReveal}>{tx('이름 보기', 'Show names')}</button>
            )}
          </div>
          <VocoderTry />

          <p className="small muted" style={{ margin: 0 }}>
            {st.bypass ? tx('지금은 내 설정을 잠시 끄고 원래 소리를 들어요. 다시 누르면 내 설정으로 돌아가요.', 'Your settings are off for now, so you hear the original sound. Press again to go back to your settings.') : tx('[내 설정 끄고 비교하기]를 켜면 원래 소리와 비교할 수 있어요.', 'Turn on [Compare without my settings] to compare with the original sound.')}
            {' '}{tx('[혼자 들어도 같은 크기로]를 켜면 한 악기만 들을 때도 소리가 작아지지 않아요.', 'Turn on [Same volume when solo] so one instrument alone does not sound quieter.')}
          </p>
        </div>
      )}
    </section>
  );
}

/** 청인(가족·팀원·발표 청중)이 CI 소리를 대략 체험해 보는 보코더. 저장하지 않고 연구 기록에도 남기지 않는다 */
function VocoderTry() {
  const { vocoder: v } = useEngineState();
  const channels = [4, 8, 16];
  return (
    <div className="stack" role="group" aria-label={tx('인공와우 소리 체험', 'Cochlear implant sound demo')}>
      <h3 style={{ margin: 0 }}>{tx('인공와우 소리 체험 (들을 수 있는 분용)', 'Cochlear implant sound demo (for hearing listeners)')}</h3>
      <p className="small muted" style={{ margin: 0 }}>
        {tx('가족이나 주변 사람이 인공와우로 듣는 느낌을 대략 들어 보는 기능이에요. 소리를 몇 개의 띠로 나누고 크기 변화만 남겨요. 실제 인공와우 소리와는 많이 다를 수 있어요. 인공와우를 쓰는 분께는 도움이 되지 않아요.', 'This lets family and others get a rough sense of listening with a cochlear implant. It splits the sound into a few bands and keeps only how loud each band is. It can be very different from real implant sound. It does not help people who use an implant.')}
      </p>
      <div className="row">
        <Chip pressed={v.on} onClick={() => engine.setVocoder({ on: !v.on })}>
          {v.on ? tx('체험 소리 켜짐', 'Demo sound on') : tx('체험 소리 켜기', 'Turn on demo sound')}
        </Chip>
      </div>
      {v.on && (
        <>
          <div className="row" role="group" aria-label={tx('띠 개수', 'Number of bands')}>
            <span className="small">{tx('띠 개수', 'Bands')}</span>
            {channels.map((n) => (
              <Chip key={n} pressed={v.channels === n} onClick={() => engine.setVocoder({ channels: n })}>{n}</Chip>
            ))}
          </div>
          <div className="row" role="group" aria-label={tx('바탕 소리', 'Carrier sound')}>
            <span className="small">{tx('바탕 소리', 'Carrier')}</span>
            <Chip pressed={v.carrier === 'noise'} onClick={() => engine.setVocoder({ carrier: 'noise' })}>{tx('잡음', 'Noise')}</Chip>
            <Chip pressed={v.carrier === 'sine'} onClick={() => engine.setVocoder({ carrier: 'sine' })}>{tx('순음', 'Tones')}</Chip>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {tx('띠가 적을수록 음높이가 더 흐려져요. 지금 소리는 녹음 전 자리표시라서 차이가 잘 들리지 않을 수 있어요.', 'Fewer bands make pitch blurrier. The current sound is a placeholder before recording, so the difference may be hard to hear.')}
          </p>
        </>
      )}
    </div>
  );
}
