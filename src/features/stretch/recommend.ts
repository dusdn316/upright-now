import { STRETCH_ROUTINES } from '@/constants/stretch'
import type { LearningProfileKind, StretchRoutine } from '@/types'

/**
 * 모드별 가중 랜덤 추천 — docs/09 §3, §4
 * 직전에 나온 동작은 제외합니다.
 */
type Mode = Exclude<LearningProfileKind, 'custom'>

function modeOf(profileId: LearningProfileKind): Mode {
  return profileId === 'custom' ? 'home' : profileId
}

export function recommendStretch(
  profileId: LearningProfileKind,
  excludeId?: string,
  rand: () => number = Math.random,
): StretchRoutine {
  const mode = modeOf(profileId)
  const pool = STRETCH_ROUTINES.filter((r) => r.id !== excludeId)
  const list = pool.length > 0 ? pool : STRETCH_ROUTINES

  const weights = list.map((r) => Math.max(0, r.weights[mode]))
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return list[0]

  let ticket = rand() * total
  for (let i = 0; i < list.length; i += 1) {
    ticket -= weights[i]
    if (ticket <= 0) return list[i]
  }
  return list[list.length - 1]
}
