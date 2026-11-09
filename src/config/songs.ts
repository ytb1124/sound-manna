// 곡 설정. 실제 녹음이 준비되면 이 파일의 `url`만 채우면 된다(README "핑크노이즈를 실제 음원으로 바꾸기").
//
// - url이 null이면 그 스템은 핑크노이즈 자리표시로 만든다(src/audio/placeholder.ts).
// - url을 넣으면 그 파일을 decodeAudioData로 읽는다. 파일은 prototype/public/audio/ 에 두고
//   'audio/hbd_stem_trumpet.flac' 처럼 앞에 /를 붙이지 않고 적는다(사이트가 /ci-ensemble-room/ 아래에 있어서
//   /로 시작하면 파일을 못 찾는다). 파일명 규칙은 구성안 8.2절.
// - 모든 스템은 길이와 시작 샘플이 같아야 한다(구성안 8.3절).
// - timelineUrl(선택): 오프라인 분석 JSON(구성안 7.4절). 없으면 불러올 때 버퍼에서 직접 계산한다.
// - 구간(줄)은 박 단위로 적는다. 녹음을 클릭 트랙에 맞추면(8.2절) bpm과 startOffsetSec만 맞추면 그대로 쓸 수 있다.

import { tx } from '../i18n';
import type { SongId, StemId } from '../types';

export interface StemSource {
  url: string | null;
  timelineUrl?: string | null;
}

export interface SongConfig {
  id: SongId;
  /** 화면 제목. 곡 2는 미정이므로 제목을 정하지 않는다 */
  title: string;
  /** 정해지지 않은 곡이면 true. 화면에 "미정" 꼬리표를 붙인다 */
  undecided: boolean;
  meter: 3 | 4;
  bpm: number;
  /** 첫 박(카혼 예비박 시작)이 파일의 몇 초에 있는지 */
  startOffsetSec: number;
  /** 자리표시 소리의 곡 길이(초, 임시값). 실제 파일이 있으면 파일 길이를 쓴다 */
  placeholderDurationSec: number;
  stems: Record<StemId, StemSource>;
  /** 구간 반복용 줄 구분(박 단위, 0 = 예비박 첫 박) */
  lines: { id: string; label: string; startBeat: number; endBeat: number; note?: string }[];
  /** 보정 ②에서 쓰는 합주 4마디 루프(박 단위) */
  calibLoopBeats: [number, number];
  /** 보정 ⑥에서 쓰는 베이스 2마디(박 단위) */
  bassLoopBeats: [number, number];
}

export const SONGS: Record<SongId, SongConfig> = {
  hbd: {
    id: 'hbd',
    get title() {
      return tx('생일 축하합니다', 'Happy Birthday to You');
    },
    undecided: false,
    meter: 3,
    // 2026-11 녹음(HBD_Stem): 100 BPM, 카혼이 0.6초에 첫 마디 첫 박으로 들어온다.
    // 피아노는 0초부터 전주, 4마디(12박) 뒤 7.2초에 멜로디 못갖춘마디("생일")가 나온다.
    // 1절 = 24박(14.4초). 2절 7.2+14.4 = 21.6초, 3절 36.0초. 3절 3줄 끝에 한 마디 늘임(늘임표)이 있다.
    bpm: 100,
    startOffsetSec: 0.6,
    placeholderDurationSec: 56.4, // 실제 파일이 있으면 쓰이지 않는다
    stems: {
      piano: { url: 'audio/hbd_stem_piano.flac' },
      cajon: { url: 'audio/hbd_stem_cajon.flac' },
      bass: { url: 'audio/hbd_stem_bass.flac' },
      trumpet: { url: 'audio/hbd_stem_trumpet.flac' },
      // 따로 녹음한 옥타브 테이크가 아직 없어서, 베이스 녹음을 한 옥타브 올린 임시 파일이다.
      bassOct: { url: 'audio/hbd_stem_bass_oct.flac' },
    },
    // 줄 = 못갖춘마디 시작(여린박)부터 다음 줄 여린박 전까지. 1절 선율 기준(박 11 = 7.2초).
    lines: [
      { id: 'line1', get label() { return tx('1줄', 'Line 1'); }, startBeat: 11, endBeat: 17 },
      { id: 'line2', get label() { return tx('2줄', 'Line 2'); }, startBeat: 17, endBeat: 23 },
      {
        id: 'line3',
        get label() { return tx('3줄', 'Line 3'); },
        startBeat: 23,
        endBeat: 29,
        get note() { return tx('멜로디가 크게 뛰어오르는 곳(한 옥타브)', 'Where the melody makes a big jump up (one octave)'); },
      },
      { id: 'line4', get label() { return tx('4줄', 'Line 4'); }, startBeat: 29, endBeat: 35 },
    ],
    calibLoopBeats: [12, 24],
    bassLoopBeats: [12, 18],
  },
  song2: {
    id: 'song2',
    get title() {
      return tx('곡 2 (미정)', 'Song 2 (TBD)');
    },
    undecided: true,
    meter: 4,
    bpm: 100, // 임시값
    startOffsetSec: 0,
    placeholderDurationSec: 42, // 임시값
    stems: {
      piano: { url: null },
      cajon: { url: null },
      bass: { url: null },
      trumpet: { url: null },
      bassOct: { url: null },
    },
    lines: [
      { id: 'line1', get label() { return tx('1줄', 'Line 1'); }, startBeat: 4, endBeat: 20 },
      { id: 'line2', get label() { return tx('2줄', 'Line 2'); }, startBeat: 20, endBeat: 36 },
      { id: 'line3', get label() { return tx('3줄', 'Line 3'); }, startBeat: 36, endBeat: 52 },
      { id: 'line4', get label() { return tx('4줄', 'Line 4'); }, startBeat: 52, endBeat: 68 },
    ],
    calibLoopBeats: [4, 20],
    bassLoopBeats: [4, 12],
  },
};

export const SONG_IDS: SongId[] = ['hbd', 'song2'];

export const beatSec = (song: SongConfig) => 60 / song.bpm;
export const beatToSec = (song: SongConfig, beat: number) => song.startOffsetSec + beat * beatSec(song);
