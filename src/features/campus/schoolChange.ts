/**
 * 학교 변경 제한 — 시즌 중 1회, 그리고 마지막 변경으로부터 7일에 1회.
 *
 * 두 조건을 모두 만족해야 바꿀 수 있으므로, 다음 변경 가능 시점은
 * `max(시즌 종료, 마지막 변경 + 7일)` 입니다.
 * 첫 선택은 "변경"이 아니므로 제한을 받지 않습니다.
 */
export const SCHOOL_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
export const SCHOOL_CHANGES_PER_SEASON = 1

export interface SchoolChangeHistory {
  /** 현재 선택한 학교 — null 이면 아직 고르지 않은 상태 */
  schoolId: string | null
  lastChangedAt: number | null
  /** 마지막 변경이 일어난 시즌 */
  lastChangedSeasonId: string | null
  /** 위 시즌에서의 변경 횟수 */
  changesInSeason: number
}

export type SchoolChangeBlockReason = 'season_limit' | 'cooldown' | 'same_school'

export interface SchoolChangeDecision {
  allowed: boolean
  reason?: SchoolChangeBlockReason
  /** 다음 변경 가능 시각 (알 수 있는 경우) */
  nextAllowedAt?: number
  /** 첫 선택인지 */
  firstPick: boolean
}

export interface SchoolChangeContext {
  history: SchoolChangeHistory
  seasonId: string
  seasonEndsAt: number
  now: number
}

export function canChangeSchool(
  context: SchoolChangeContext,
  nextSchoolId: string,
): SchoolChangeDecision {
  const { history, seasonId, seasonEndsAt, now } = context

  // 첫 선택 — 제한 없음
  if (!history.schoolId) return { allowed: true, firstPick: true }

  if (history.schoolId === nextSchoolId) {
    return { allowed: false, reason: 'same_school', firstPick: false }
  }

  const changesInSeason = history.lastChangedSeasonId === seasonId ? history.changesInSeason : 0

  const cooldownEndsAt =
    history.lastChangedAt === null ? 0 : history.lastChangedAt + SCHOOL_CHANGE_COOLDOWN_MS

  if (changesInSeason >= SCHOOL_CHANGES_PER_SEASON) {
    return {
      allowed: false,
      reason: 'season_limit',
      nextAllowedAt: Math.max(seasonEndsAt, cooldownEndsAt),
      firstPick: false,
    }
  }

  if (now < cooldownEndsAt) {
    return {
      allowed: false,
      reason: 'cooldown',
      nextAllowedAt: cooldownEndsAt,
      firstPick: false,
    }
  }

  return { allowed: true, firstPick: false }
}

/** 변경을 실제로 반영한 뒤의 이력 */
export function applySchoolChange(
  history: SchoolChangeHistory,
  nextSchoolId: string,
  seasonId: string,
  now: number,
): SchoolChangeHistory {
  const firstPick = !history.schoolId
  const changesInSeason =
    history.lastChangedSeasonId === seasonId ? history.changesInSeason : 0

  return {
    schoolId: nextSchoolId,
    // 첫 선택은 변경 횟수·쿨다운을 소모하지 않습니다.
    lastChangedAt: firstPick ? history.lastChangedAt : now,
    lastChangedSeasonId: firstPick ? history.lastChangedSeasonId : seasonId,
    changesInSeason: firstPick ? changesInSeason : changesInSeason + 1,
  }
}

export const SCHOOL_CHANGE_MESSAGE: Record<SchoolChangeBlockReason, string> = {
  season_limit: '이번 시즌의 학교 변경을 이미 사용했어요.',
  cooldown: '학교 변경은 마지막 변경으로부터 7일이 지난 뒤에 할 수 있어요.',
  same_school: '이미 선택한 학교예요.',
}

export function formatNextAllowed(nextAllowedAt: number | undefined): string | null {
  if (!nextAllowedAt) return null
  return new Date(nextAllowedAt).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
