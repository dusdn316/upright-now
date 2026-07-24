import type { CharacterStageMeta } from '@/types'

/**
 * 게임 수치 — docs/07_GAME_SYSTEM_SPEC.md §4, §7
 * 모두 밸런스 테스트용 초기값입니다.
 */

export const CHARACTER_STAGES: CharacterStageMeta[] = [
  { stage: 1, name: '뽀각 거북', tagline: '아직 목을 숨긴 새내기', requiredXp: 0 },
  { stage: 2, name: '꿈틀 거북', tagline: '조금씩 목을 내미는 중', requiredXp: 250 },
  { stage: 3, name: '빼꼼 거부기린', tagline: '기린의 모습이 빼꼼', requiredXp: 600 },
  { stage: 4, name: '반듯 거부기린', tagline: '목과 몸통이 반듯해지는 중', requiredXp: 1000 },
  { stage: 5, name: '쭉쭉 기린', tagline: '스스로 자세를 자주 회복해요', requiredXp: 1500 },
  { stage: 6, name: '우뚝 기린', tagline: '편안한 자세 습관을 완성했어요', requiredXp: 2200 },
]

/** 보스에게 주는 피해량 */
export const DAMAGE = {
  sessionCompleted: 100,
  recovery: 40,
  giraffeSync: 60,
  bothCompleted: 150,
  goalCompleted: 30,
} as const

/** 경험치와 잎사귀 포인트 */
export const REWARD = {
  sessionCompleted: { xp: 100, points: 100 },
  recovery: { xp: 30, points: 10 },
  stretch: { xp: 20, points: 20 },
  roomCompleted: { xp: 30, points: 30 },
  goalCompleted: { xp: 20, points: 20 },
} as const

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
