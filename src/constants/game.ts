import type { CharacterStageMeta } from '@/types'

/**
 * 게임 수치 — docs/07_GAME_SYSTEM_SPEC.md §4, §7
 * 모두 밸런스 테스트용 초기값입니다.
 */

export const CHARACTER_STAGES: CharacterStageMeta[] = [
  { stage: 1, name: '뽀각 거북', tagline: '아직 목을 숨긴 새내기', requiredXp: 0, visualDiff: '목을 완전히 숨긴 큰 등껍질' },
  { stage: 2, name: '꿈틀 거북', tagline: '조금씩 목을 내미는 중', requiredXp: 250, visualDiff: '머리와 짧은 목이 등장해요' },
  { stage: 3, name: '빼꼼 거부기린', tagline: '기린의 모습이 빼꼼', requiredXp: 600, visualDiff: '짧은 기린 목·작은 뿔·큰 등껍질' },
  { stage: 4, name: '반듯 거부기린', tagline: '목과 몸통이 반듯해지는 중', requiredXp: 1000, visualDiff: '중간 길이 목과 세워진 몸통' },
  { stage: 5, name: '쭉쭉 기린', tagline: '스스로 자세를 자주 회복해요', requiredXp: 1500, visualDiff: '완전한 기린 체형과 긴 목' },
  { stage: 6, name: '우뚝 기린', tagline: '편안한 자세 습관을 완성했어요', requiredXp: 2200, visualDiff: '가장 긴 목·과잠·백팩·당당한 표정' },
]

/** 보스에게 주는 피해량 */
export const DAMAGE = {
  sessionCompleted: 100,
  recovery: 40,
  giraffeSync: 60,
  bothCompleted: 150,
  goalCompleted: 30,
  /** 유효 감지 집중 5분마다 — 자세를 무너뜨리지 않아도 괴물을 공격 */
  focus: 20,
} as const

/** 유효 집중 공격 주기 (감지 가능 시간 기준) */
export const FOCUS_ATTACK_INTERVAL_MS = 5 * 60 * 1000

/** 경험치와 잎사귀 포인트 */
/**
 * 경제 v2 — 기존 획득분은 차감하지 않고 "새 이벤트"부터 이 표를 적용합니다.
 * 세션 완주는 길이별(sessionCompletionReward), 아래는 행동 보상 기본값.
 */
export const REWARD = {
  /** 15~29분 구간 기본값 — 실제 지급은 sessionCompletionReward 사용 */
  sessionCompleted: { xp: 60, points: 30 },
  recovery: { xp: 25, points: 5 },
  stretch: { xp: 10, points: 10 },
  /** 친구 공동 완주 추가 보너스 */
  roomCompleted: { xp: 20, points: 10 },
  goalCompleted: { xp: 15, points: 10 },
} as const

/** 세션 완주 보상 — 계획 길이(분) 기준 */
export function sessionCompletionReward(plannedMin: number): {
  xp: number
  points: number
} {
  if (plannedMin < 5) return { xp: 0, points: 0 } // 1분 점검 등 — 보상 없음
  if (plannedMin < 15) return { xp: 20, points: 10 }
  if (plannedMin < 30) return { xp: 60, points: 30 }
  if (plannedMin < 50) return { xp: 80, points: 40 }
  return { xp: 120, points: 60 }
}

/** 개인 괴물 장기 진행도 — 4단계 체력 */
export const MONSTER_PHASE_HP = [600, 900, 1300, 1800] as const

/**
 * 마감괴수 D-DAY 기본 체력.
 * 혼자 모드 값은 문서에 없어 supabase/schema.sql 의 boss_hp 기본값(1000)을 따릅니다.
 */
export const BOSS_MAX_HP = 1000

export const BOSS_NAME = '마감괴수 D-DAY'

export type BossPhase = 'calm' | 'angry' | 'rage' | 'defeated'

export function getBossPhase(hp: number, maxHp: number): BossPhase {
  if (hp <= 0) return 'defeated'
  const ratio = hp / maxHp
  if (ratio > 0.6) return 'calm'
  if (ratio > 0.3) return 'angry'
  return 'rage'
}

export const BOSS_PHASE_LABEL: Record<BossPhase, string> = {
  calm: '과제지를 쌓는 중',
  angry: '포스트잇을 뿌리는 중',
  rage: '23:59 폭주',
  defeated: '제출 완료',
}
