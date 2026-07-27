import { STRETCH_ROUTINES } from '@/constants/stretch'
import type { StretchPref } from '@/features/modes/modeStore'
import type { StretchRoutine } from '@/types'

/**
 * 스트레칭 가중 랜덤 추천 — docs/09 §3, §4
 *
 * 모드의 stretch 설정(앉아서/혼합/전신)이 실제 가중치 열을 결정합니다.
 * - seated: 앉아서 가능한 동작 위주 (서서 하는 calf-raise 가중 최소)
 * - mixed: 전체를 균형 있게
 * - full: 서서 하는 동작 가중 증가
 * 기본 3모드의 기존 가중치(library/home/team 열)는 그대로 보존되며,
 * 내 모드는 저장한 stretch 설정을 그대로 사용합니다.
 * 직전에 나온 동작은 제외합니다.
 */
const PREF_TO_WEIGHT_COLUMN: Record<StretchPref, 'library' | 'home' | 'team'> = {
  seated: 'library', // 앉아서 — calf-raise 가중 1 (최소)
  full: 'home', // 전신 — calf-raise 가중 5 (증가)
  mixed: 'team', // 혼합 — 균형
}

export function recommendStretch(
  pref: StretchPref,
  excludeId?: string,
  rand: () => number = Math.random,
): StretchRoutine {
  const column = PREF_TO_WEIGHT_COLUMN[pref]
  const pool = STRETCH_ROUTINES.filter((r) => r.id !== excludeId)
  const list = pool.length > 0 ? pool : STRETCH_ROUTINES

  const weights = list.map((r) => Math.max(0, r.weights[column]))
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return list[0]

  let ticket = rand() * total
  for (let i = 0; i < list.length; i += 1) {
    ticket -= weights[i]
    if (ticket <= 0) return list[i]
  }
  return list[list.length - 1]
}
