import type { SessionSummary } from '@/types'

/**
 * 대시보드 "오늘의 집중 시간" 집계 — 순수 함수.
 *
 * 포함: 오늘 시작된 실제 세션의 집중 시간(elapsedMs). 정상 완료뿐 아니라
 *       중도 종료 세션에서 실제 집중한 시간도 포함합니다.
 * 제외: 데모·QA 세션(저장 단계에서 이미 기록되지 않음, finalizeSession 참고),
 *       독립 스트레칭(SessionRecord 를 만들지 않음), 중복 sessionId(1회만).
 */

/** 같은 sessionId 는 1회만 — 목록이 최신순이므로 최신 기록을 남깁니다. */
export function dedupeBySessionId(summaries: SessionSummary[]): SessionSummary[] {
  const seen = new Set<string>()
  const out: SessionSummary[] = []
  for (const summary of summaries) {
    // 구버전 기록(sessionId 없음)은 요약 id 로 구분합니다.
    const key = summary.sessionId ?? summary.id
    if (seen.has(key)) continue
    seen.add(key)
    out.push(summary)
  }
  return out
}

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export interface TodayFocusStats {
  /** 오늘 시작된 세션의 집중 시간 합 (중복 제거 후) */
  focusedMs: number
  /** 오늘 시작돼 완료 인정된 세션 수 */
  completedCount: number
  /** 오늘 시작된 세션 수 (중도 종료 포함) */
  sessionCount: number
}

export function selectTodayFocus(
  summaries: SessionSummary[],
  now = Date.now(),
): TodayFocusStats {
  const today = dedupeBySessionId(summaries).filter((s) =>
    isSameLocalDay(s.startedAt, now),
  )
  return {
    focusedMs: today.reduce((sum, s) => sum + s.elapsedMs, 0),
    completedCount: today.filter((s) => s.status === 'completed').length,
    sessionCount: today.length,
  }
}

/** 전체 누적 집중 시간 (중복 제거 후) — "완료 세션 수 × 25분" 같은 추정 금지 */
export function selectTotalFocusMs(summaries: SessionSummary[]): number {
  return dedupeBySessionId(summaries).reduce((sum, s) => sum + s.elapsedMs, 0)
}

/** 17초 → "0:17", 25분 → "25:00", 1시간 5분 → "1:05:00" */
export function formatFocusClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export interface SessionStats {
  /** sessionId 중복 제거 + 1분 점검 제외 목록 (최신순) */
  deduped: SessionSummary[]
  totalFocusedMs: number
  completedCount: number
  abortedCount: number
  detectableMs: number
  recoveries: number
  /** 실제 최근 세션 3개 */
  recentSessions: SessionSummary[]
}

/**
 * 홈·기록·성장 화면이 공유하는 단일 집계 — 이 함수 밖에서
 * summaries.reduce 나 progression.completedSessions 를 직접 쓰지 않습니다.
 */
export function selectSessionStats(summaries: SessionSummary[]): SessionStats {
  const deduped = dedupeBySessionId(summaries).filter((s) => !s.isTest)
  let totalFocusedMs = 0
  let completedCount = 0
  let abortedCount = 0
  let detectableMs = 0
  let recoveries = 0
  for (const s of deduped) {
    totalFocusedMs += s.elapsedMs
    detectableMs += s.detectableMs
    recoveries += s.recoveries
    if (s.status === 'completed') completedCount += 1
    else abortedCount += 1
  }
  return {
    deduped,
    totalFocusedMs,
    completedCount,
    abortedCount,
    detectableMs,
    recoveries,
    recentSessions: deduped.slice(0, 3),
  }
}
