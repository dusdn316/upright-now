import type {
  CampusContributionKind,
  CampusSchoolStanding,
} from './types'

/**
 * 기여도 계산과 악용 방지 — 순수 함수.
 *
 * 자세 점수는 절대 쓰지 않습니다. 정상 완료 세션·자세 회복 성공·친구 세션 완주·
 * 스트레칭 완주만 기여 이벤트가 됩니다. 중도 종료·데모·QA 는 기여도가 없습니다.
 * (docs/CAMPUS_TERRITORY_SPEC.md §3)
 */
export const CONTRIBUTION_POINTS: Record<CampusContributionKind, number> = {
  session_completed: 100,
  posture_recovered: 20,
  friend_session_completed: 50,
  stretch_completed: 20,
}

export const CONTRIBUTION_LIMITS = {
  /** 하루 최대 기여도 (로컬 날짜 기준) */
  dailyCap: 600,
  /** 회복 기여는 세션당 최대 5회 (= 100점) */
  recoveryPerSession: 5,
  /** 동일 익명 사용자의 과도한 이벤트 제한 */
  eventsPerMinute: 12,
  /** 회복 기여 사이 최소 간격 */
  minRecoveryIntervalMs: 20_000,
} as const

/** 세션 단위로 딱 한 번만 인정하는 종류 */
const SESSION_UNIQUE_KINDS: CampusContributionKind[] = [
  'session_completed',
  'friend_session_completed',
]

export type ContributionRejectReason =
  | 'duplicate_event'
  | 'duplicate_session'
  | 'daily_cap'
  | 'recovery_cap'
  | 'recovery_cooldown'
  | 'rate_limited'

/** 로컬 원장 — 직렬화 가능한 형태로만 둡니다. (localStorage 저장) */
export interface ContributionLedger {
  seenEventIds: string[]
  /** `${kind}:${sessionId}` */
  seenSessionKeys: string[]
  /** `YYYY-MM-DD` → 누적 점수 */
  dailyTotals: Record<string, number>
  /** sessionId → 회복 기여 횟수 */
  recoveryBySession: Record<string, number>
  /** 최근 이벤트 시각 (1분 창) */
  recentEventTimes: number[]
  lastRecoveryAt: number | null
}

export function createLedger(): ContributionLedger {
  return {
    seenEventIds: [],
    seenSessionKeys: [],
    dailyTotals: {},
    recoveryBySession: {},
    recentEventTimes: [],
    lastRecoveryAt: null,
  }
}

/** 저장된 값이 깨져 있어도 앱이 죽지 않도록 방어적으로 읽습니다. */
export function normalizeLedger(value: unknown): ContributionLedger {
  const base = createLedger()
  if (!value || typeof value !== 'object') return base
  const raw = value as Partial<ContributionLedger>
  return {
    seenEventIds: Array.isArray(raw.seenEventIds) ? raw.seenEventIds.slice(-2000) : [],
    seenSessionKeys: Array.isArray(raw.seenSessionKeys)
      ? raw.seenSessionKeys.slice(-2000)
      : [],
    dailyTotals:
      raw.dailyTotals && typeof raw.dailyTotals === 'object' ? { ...raw.dailyTotals } : {},
    recoveryBySession:
      raw.recoveryBySession && typeof raw.recoveryBySession === 'object'
        ? { ...raw.recoveryBySession }
        : {},
    recentEventTimes: Array.isArray(raw.recentEventTimes) ? raw.recentEventTimes : [],
    lastRecoveryAt: typeof raw.lastRecoveryAt === 'number' ? raw.lastRecoveryAt : null,
  }
}

export function dateKeyOf(at: number): string {
  const d = new Date(at)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export interface ContributionInput {
  eventId: string
  kind: CampusContributionKind
  sessionId: string | null
  at: number
}

export interface ContributionDecision {
  accepted: boolean
  /** 실제로 인정된 점수 (하루 상한에 걸리면 남은 만큼만) */
  points: number
  /** 하루 상한 때문에 원래 점수보다 깎였는지 */
  capped: boolean
  reason?: ContributionRejectReason
  ledger: ContributionLedger
}

/**
 * 이벤트 하나를 평가합니다.
 *
 * 거절되면 원장은 그대로 돌려주므로, 같은 요청을 다시 보내도 상태가 오염되지 않습니다.
 * 예외: `duplicate_event` 는 이미 원장에 있으니 그대로 유지됩니다.
 */
export function evaluateContribution(
  ledger: ContributionLedger,
  input: ContributionInput,
): ContributionDecision {
  const { eventId, kind, sessionId, at } = input

  // 1) eventId 중복 차단
  if (ledger.seenEventIds.includes(eventId)) {
    return { accepted: false, points: 0, capped: false, reason: 'duplicate_event', ledger }
  }

  // 2) sessionId 중복 차단 (세션당 1회만 인정하는 종류)
  const sessionKey = sessionId ? `${kind}:${sessionId}` : null
  if (
    sessionKey &&
    SESSION_UNIQUE_KINDS.includes(kind) &&
    ledger.seenSessionKeys.includes(sessionKey)
  ) {
    return {
      accepted: false,
      points: 0,
      capped: false,
      reason: 'duplicate_session',
      ledger,
    }
  }

  // 3) 동일 익명 사용자의 과도한 이벤트 제한 (1분 창)
  const windowStart = at - 60_000
  const recent = ledger.recentEventTimes.filter((t) => t > windowStart)
  if (recent.length >= CONTRIBUTION_LIMITS.eventsPerMinute) {
    return {
      accepted: false,
      points: 0,
      capped: false,
      reason: 'rate_limited',
      ledger: { ...ledger, recentEventTimes: recent },
    }
  }

  // 4) 회복 기여 상한 · 최소 간격
  if (kind === 'posture_recovered') {
    if (
      ledger.lastRecoveryAt !== null &&
      at - ledger.lastRecoveryAt < CONTRIBUTION_LIMITS.minRecoveryIntervalMs
    ) {
      return {
        accepted: false,
        points: 0,
        capped: false,
        reason: 'recovery_cooldown',
        ledger,
      }
    }
    const used = sessionId ? (ledger.recoveryBySession[sessionId] ?? 0) : 0
    if (used >= CONTRIBUTION_LIMITS.recoveryPerSession) {
      return { accepted: false, points: 0, capped: false, reason: 'recovery_cap', ledger }
    }
  }

  // 5) 하루 최대 기여도
  const dateKey = dateKeyOf(at)
  const usedToday = ledger.dailyTotals[dateKey] ?? 0
  const remaining = CONTRIBUTION_LIMITS.dailyCap - usedToday
  if (remaining <= 0) {
    return { accepted: false, points: 0, capped: true, reason: 'daily_cap', ledger }
  }

  const base = CONTRIBUTION_POINTS[kind]
  const points = Math.min(base, remaining)

  const next: ContributionLedger = {
    seenEventIds: [...ledger.seenEventIds, eventId].slice(-2000),
    seenSessionKeys: sessionKey
      ? [...ledger.seenSessionKeys, sessionKey].slice(-2000)
      : ledger.seenSessionKeys,
    dailyTotals: { ...ledger.dailyTotals, [dateKey]: usedToday + points },
    recoveryBySession:
      kind === 'posture_recovered' && sessionId
        ? {
            ...ledger.recoveryBySession,
            [sessionId]: (ledger.recoveryBySession[sessionId] ?? 0) + 1,
          }
        : ledger.recoveryBySession,
    recentEventTimes: [...recent, at],
    lastRecoveryAt: kind === 'posture_recovered' ? at : ledger.lastRecoveryAt,
  }

  return { accepted: true, points, capped: points < base, ledger: next }
}

/* ------------------------------ 규모 보정 점수 ----------------------------- */

/**
 * 학교 규모가 큰 곳이 무조건 이기지 않도록 총 기여도와 함께 보정 점수를 씁니다.
 *
 *   normalizedScore = totalContribution / sqrt(max(activeContributors, 1))
 *
 * 실제 공식 순위가 아니며, 화면에도 그렇게 표시합니다.
 */
export function normalizedScore(
  totalContribution: number,
  activeContributors: number,
): number {
  return totalContribution / Math.sqrt(Math.max(activeContributors, 1))
}

export function withNormalizedScore(
  input: Omit<CampusSchoolStanding, 'normalizedScore'>,
): CampusSchoolStanding {
  return {
    ...input,
    normalizedScore: normalizedScore(input.totalContribution, input.activeContributors),
  }
}

/** 규모 보정 점수 내림차순 → 동점이면 총 기여도 → 학교 id */
export function rankStandings(standings: CampusSchoolStanding[]): CampusSchoolStanding[] {
  return [...standings].sort(
    (a, b) =>
      b.normalizedScore - a.normalizedScore ||
      b.totalContribution - a.totalContribution ||
      a.schoolId.localeCompare(b.schoolId),
  )
}

export const CONTRIBUTION_LABEL: Record<CampusContributionKind, string> = {
  session_completed: '세션 정상 완료',
  posture_recovered: '자세 회복 성공',
  friend_session_completed: '친구 세션 완주',
  stretch_completed: '스트레칭 완주',
}

export const REJECT_LABEL: Record<ContributionRejectReason, string> = {
  duplicate_event: '이미 반영된 이벤트예요.',
  duplicate_session: '이 세션의 기여는 이미 반영했어요.',
  daily_cap: '오늘 기여도 상한에 도달했어요.',
  recovery_cap: '이번 세션의 회복 기여 상한에 도달했어요.',
  recovery_cooldown: '회복 기여는 잠시 뒤에 다시 반영돼요.',
  rate_limited: '짧은 시간에 너무 많은 이벤트가 들어왔어요.',
}
