import { describe, expect, it } from 'vitest'
import {
  dedupeBySessionId,
  formatFocusClock,
  selectTodayFocus,
  selectTotalFocusMs,
} from './todayFocus'
import type { SessionSummary } from '@/types'

const NOW = new Date('2026-07-25T14:00:00').getTime()

function summary(overrides: Partial<SessionSummary>): SessionSummary {
  return {
    id: `sum-${Math.random()}`,
    sessionId: 's-1',
    startedAt: NOW - 60_000,
    endedAt: NOW,
    status: 'completed',
    plannedDurationMs: 1_500_000,
    elapsedMs: 1_500_000,
    detectableMs: 1_500_000,
    awayMs: 0,
    unstableMs: 0,
    recoveryOpportunities: 0,
    recoveries: 0,
    bestCombo: 0,
    damageDealt: 0,
    xpEarned: 0,
    pointsEarned: 0,
    ...overrides,
  }
}

describe('오늘의 집중 시간 집계 (대시보드)', () => {
  it('17초 중도 종료 → 오늘의 집중 0:17 · 완료 세션 0회', () => {
    const stats = selectTodayFocus(
      [summary({ sessionId: 's-a', status: 'aborted', elapsedMs: 17_000 })],
      NOW,
    )
    expect(stats.focusedMs).toBe(17_000)
    expect(stats.completedCount).toBe(0)
    expect(stats.sessionCount).toBe(1)
    expect(formatFocusClock(stats.focusedMs)).toBe('0:17')
  })

  it('25분 완료 → 집중 +25:00 · 완료 세션 +1', () => {
    const stats = selectTodayFocus(
      [
        summary({ sessionId: 's-a', status: 'aborted', elapsedMs: 17_000 }),
        summary({ sessionId: 's-b', status: 'completed', elapsedMs: 1_500_000 }),
      ],
      NOW,
    )
    expect(stats.focusedMs).toBe(1_517_000)
    expect(stats.completedCount).toBe(1)
    expect(stats.sessionCount).toBe(2)
  })

  it('같은 sessionId 는 두 번 저장돼도 1회만 합산한다', () => {
    const stats = selectTodayFocus(
      [
        summary({ sessionId: 's-dup', elapsedMs: 1_500_000 }),
        summary({ sessionId: 's-dup', elapsedMs: 1_500_000 }),
      ],
      NOW,
    )
    expect(stats.focusedMs).toBe(1_500_000)
    expect(stats.completedCount).toBe(1)
  })

  it('어제 시작한 세션은 오늘의 집중에 넣지 않는다', () => {
    const stats = selectTodayFocus(
      [
        summary({
          sessionId: 's-yesterday',
          startedAt: NOW - 24 * 3600_000,
          elapsedMs: 1_500_000,
        }),
      ],
      NOW,
    )
    expect(stats.focusedMs).toBe(0)
    expect(stats.sessionCount).toBe(0)
  })

  it('구버전 기록(sessionId 없음)은 서로 다른 세션으로 취급한다', () => {
    const legacyA = summary({ elapsedMs: 60_000 })
    const legacyB = summary({ elapsedMs: 90_000 })
    delete legacyA.sessionId
    delete legacyB.sessionId
    expect(dedupeBySessionId([legacyA, legacyB])).toHaveLength(2)
  })

  it('누적 집중은 중복 제거 후 실제 elapsedMs 의 합이다', () => {
    const total = selectTotalFocusMs([
      summary({ sessionId: 's-a', elapsedMs: 17_000 }),
      summary({ sessionId: 's-a', elapsedMs: 17_000 }),
      summary({ sessionId: 's-b', elapsedMs: 300_000 }),
    ])
    expect(total).toBe(317_000)
  })

  it('formatFocusClock — 0:00 · 0:17 · 25:00 · 1:05:00', () => {
    expect(formatFocusClock(0)).toBe('0:00')
    expect(formatFocusClock(17_000)).toBe('0:17')
    expect(formatFocusClock(1_500_000)).toBe('25:00')
    expect(formatFocusClock(3_900_000)).toBe('1:05:00')
  })
})
