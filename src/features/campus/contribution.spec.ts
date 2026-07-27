import { describe, expect, it } from 'vitest'
import {
  CONTRIBUTION_LIMITS,
  CONTRIBUTION_POINTS,
  createLedger,
  dateKeyOf,
  evaluateContribution,
  normalizedScore,
  normalizeLedger,
  rankStandings,
  withNormalizedScore,
  type ContributionLedger,
} from './contribution'

const T0 = Date.UTC(2026, 6, 20, 3, 0, 0)

function accept(
  ledger: ContributionLedger,
  input: Parameters<typeof evaluateContribution>[1],
) {
  const result = evaluateContribution(ledger, input)
  return result
}

describe('기여 이벤트 점수', () => {
  it('정상 완료 100 · 회복 20 · 친구 완주 50 · 스트레칭 20', () => {
    expect(CONTRIBUTION_POINTS.session_completed).toBe(100)
    expect(CONTRIBUTION_POINTS.posture_recovered).toBe(20)
    expect(CONTRIBUTION_POINTS.friend_session_completed).toBe(50)
    expect(CONTRIBUTION_POINTS.stretch_completed).toBe(20)
  })

  it('정상 완료 세션이 100점으로 인정된다', () => {
    const result = accept(createLedger(), {
      eventId: 'e1',
      kind: 'session_completed',
      sessionId: 's1',
      at: T0,
    })
    expect(result.accepted).toBe(true)
    expect(result.points).toBe(100)
  })
})

describe('악용 방지', () => {
  it('같은 eventId 는 두 번 반영되지 않는다', () => {
    const first = accept(createLedger(), {
      eventId: 'dup',
      kind: 'session_completed',
      sessionId: 's1',
      at: T0,
    })
    const second = accept(first.ledger, {
      eventId: 'dup',
      kind: 'session_completed',
      sessionId: 's1',
      at: T0 + 1000,
    })

    expect(second.accepted).toBe(false)
    expect(second.reason).toBe('duplicate_event')
    expect(second.points).toBe(0)
  })

  it('같은 sessionId 의 완주는 eventId 가 달라도 한 번만 인정된다', () => {
    const first = accept(createLedger(), {
      eventId: 'a',
      kind: 'session_completed',
      sessionId: 'same-session',
      at: T0,
    })
    const second = accept(first.ledger, {
      eventId: 'b',
      kind: 'session_completed',
      sessionId: 'same-session',
      at: T0 + 5000,
    })

    expect(second.accepted).toBe(false)
    expect(second.reason).toBe('duplicate_session')
  })

  it('친구 세션 완주도 세션당 1회만 인정된다', () => {
    let ledger = createLedger()
    ledger = accept(ledger, {
      eventId: 'f1',
      kind: 'friend_session_completed',
      sessionId: 'room-1',
      at: T0,
    }).ledger
    const again = accept(ledger, {
      eventId: 'f2',
      kind: 'friend_session_completed',
      sessionId: 'room-1',
      at: T0 + 1000,
    })
    expect(again.reason).toBe('duplicate_session')
  })

  it('회복 기여는 세션당 5회까지만 반영된다', () => {
    let ledger = createLedger()
    let accepted = 0
    for (let i = 0; i < 8; i += 1) {
      const result = accept(ledger, {
        eventId: `r${i}`,
        kind: 'posture_recovered',
        sessionId: 'session-x',
        // 최소 간격을 지키면서 넣습니다.
        at: T0 + i * CONTRIBUTION_LIMITS.minRecoveryIntervalMs * 2,
      })
      ledger = result.ledger
      if (result.accepted) accepted += 1
    }
    expect(accepted).toBe(CONTRIBUTION_LIMITS.recoveryPerSession)
  })

  it('회복 기여는 최소 간격 안에서 연속으로 들어오면 거절된다', () => {
    const first = accept(createLedger(), {
      eventId: 'r1',
      kind: 'posture_recovered',
      sessionId: 's1',
      at: T0,
    })
    const tooSoon = accept(first.ledger, {
      eventId: 'r2',
      kind: 'posture_recovered',
      sessionId: 's1',
      at: T0 + 1000,
    })
    expect(tooSoon.reason).toBe('recovery_cooldown')
  })

  it('하루 최대 기여도를 넘으면 남은 만큼만 인정하고 그 뒤로는 거절한다', () => {
    let ledger = createLedger()
    let total = 0
    for (let i = 0; i < 12; i += 1) {
      const result = accept(ledger, {
        eventId: `d${i}`,
        kind: 'session_completed',
        sessionId: `session-${i}`,
        // 1분 창 제한을 피하려고 이벤트를 5분 간격으로 둡니다.
        at: T0 + i * 5 * 60_000,
      })
      ledger = result.ledger
      total += result.points
    }
    expect(total).toBe(CONTRIBUTION_LIMITS.dailyCap)

    const overflow = accept(ledger, {
      eventId: 'overflow',
      kind: 'session_completed',
      sessionId: 'session-final',
      at: T0 + 20 * 5 * 60_000,
    })
    expect(overflow.accepted).toBe(false)
    expect(overflow.reason).toBe('daily_cap')
  })

  it('하루가 지나면 상한이 초기화된다', () => {
    let ledger = createLedger()
    for (let i = 0; i < 6; i += 1) {
      ledger = accept(ledger, {
        eventId: `x${i}`,
        kind: 'session_completed',
        sessionId: `s${i}`,
        at: T0 + i * 5 * 60_000,
      }).ledger
    }
    const nextDay = accept(ledger, {
      eventId: 'next-day',
      kind: 'session_completed',
      sessionId: 'next',
      at: T0 + 26 * 60 * 60 * 1000,
    })
    expect(nextDay.accepted).toBe(true)
    expect(nextDay.points).toBe(100)
  })

  it('1분에 12건을 넘으면 과도한 이벤트로 거절된다', () => {
    let ledger = createLedger()
    let rejected = 0
    for (let i = 0; i < 20; i += 1) {
      const result = accept(ledger, {
        eventId: `burst-${i}`,
        kind: 'stretch_completed',
        sessionId: null,
        at: T0 + i * 100,
      })
      ledger = result.ledger
      if (result.reason === 'rate_limited') rejected += 1
    }
    expect(rejected).toBeGreaterThan(0)
  })

  it('거절된 이벤트는 원장에 점수를 남기지 않는다', () => {
    const first = accept(createLedger(), {
      eventId: 'once',
      kind: 'session_completed',
      sessionId: 's1',
      at: T0,
    })
    const dayKey = dateKeyOf(T0)
    const before = first.ledger.dailyTotals[dayKey]

    const dup = accept(first.ledger, {
      eventId: 'once',
      kind: 'session_completed',
      sessionId: 's1',
      at: T0 + 1,
    })
    expect(dup.ledger.dailyTotals[dayKey]).toBe(before)
  })

  it('깨진 저장 값도 안전하게 읽는다', () => {
    expect(normalizeLedger(null).seenEventIds).toEqual([])
    expect(normalizeLedger('nope').dailyTotals).toEqual({})
    expect(normalizeLedger({ seenEventIds: 'bad' }).seenEventIds).toEqual([])
  })
})

describe('학교 규모 보정', () => {
  it('normalizedScore = total / sqrt(max(activeContributors,1))', () => {
    expect(normalizedScore(400, 4)).toBe(200)
    expect(normalizedScore(100, 0)).toBe(100)
  })

  it('총 기여도가 큰 대규모 학교가 무조건 1위가 되지 않는다', () => {
    const big = withNormalizedScore({
      schoolId: 'big',
      totalContribution: 10_000,
      activeContributors: 400,
      tiles: 10,
    })
    const small = withNormalizedScore({
      schoolId: 'small',
      totalContribution: 3_000,
      activeContributors: 20,
      tiles: 4,
    })

    expect(big.totalContribution).toBeGreaterThan(small.totalContribution)
    const ranked = rankStandings([big, small])
    expect(ranked[0].schoolId).toBe('small')
  })

  it('보정 점수가 같으면 총 기여도로 순서를 정한다', () => {
    const a = withNormalizedScore({
      schoolId: 'a',
      totalContribution: 200,
      activeContributors: 4,
      tiles: 0,
    })
    const b = withNormalizedScore({
      schoolId: 'b',
      totalContribution: 100,
      activeContributors: 1,
      tiles: 0,
    })
    expect(a.normalizedScore).toBe(b.normalizedScore)
    expect(rankStandings([b, a])[0].schoolId).toBe('a')
  })
})
