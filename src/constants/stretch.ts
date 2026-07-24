import type { StretchRoutine } from '@/types'

/**
 * 스트레칭 6종과 모드별 가중치 — docs/09_STRETCH_SYSTEM_SPEC.md §2, §3
 * 실제 가중 랜덤 추천 로직은 Phase 4에서 구현합니다.
 */
export const STRETCH_ROUTINES: StretchRoutine[] = [
  {
    id: 'shoulder-roll',
    name: '어깨 천천히 돌리기',
    durationSec: 30,
    note: '어깨를 크게, 천천히 돌려 주세요.',
    weights: { library: 5, home: 4, team: 5 },
  },
  {
    id: 'scapular-squeeze',
    name: '날개뼈 가볍게 모으기',
    durationSec: 30,
    note: '가슴을 열고 등 뒤로 날개뼈를 모아 주세요.',
    weights: { library: 5, home: 4, team: 5 },
  },
  {
    id: 'wrist-forearm',
    name: '손목·전완 움직이기',
    durationSec: 30,
    note: '키보드를 오래 썼다면 손목을 부드럽게 풀어 주세요.',
    weights: { library: 5, home: 3, team: 3 },
  },
  {
    id: 'seated-twist',
    name: '앉은 상태 등 회전',
    durationSec: 45,
    note: '앉은 채로 상체를 좌우로 천천히 돌려 주세요.',
    weights: { library: 4, home: 4, team: 3 },
  },
  {
    id: 'neck-turn',
    name: '목 좌우 천천히 움직이기',
    durationSec: 30,
    note: '고개를 좌우로 천천히 움직여 주세요. 크게 원을 그리지 않아요.',
    weights: { library: 3, home: 5, team: 3 },
  },
  {
    id: 'calf-raise',
    name: '일어서기·종아리 올리기',
    durationSec: 45,
    note: '일어서서 발뒤꿈치를 천천히 올렸다 내려 주세요.',
    weights: { library: 1, home: 5, team: 5 },
  },
]
