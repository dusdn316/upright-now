import { describe, expect, it } from 'vitest'
import {
  createSessionTimeState,
  formatClock,
  formatDuration,
  remainingMs,
  tickSession,
} from './sessionMachine'
import { DEFAULT_SESSION_LENGTH_ID, getSessionLength } from '@/constants/session'

const RUNNING = (plannedMs: number) => ({
  ...createSessionTimeState(plannedMs),
  status: 'running' as const,
})

describe('세션 기본값', () => {
  it('기본 세션은 25분 집중 + 2분 회복 휴식이다', () => {
    const option = getSessionLength(DEFAULT_SESSION_LENGTH_ID)
    expect(option.focusSec).toBe(1500)
    expect(option.restSec).toBe(120)
  })

  it('알 수 없는 id 는 25분으로 되돌린다', () => {
    expect(getSessionLength('없는값').focusSec).toBe(1500)
  })
})

describe('tickSession', () => {
  it('running 이 아니면 시간이 흐르지 않는다', () => {
    const idle = createSessionTimeState(1000)
    expect(tickSession(idle, 1000, 'good')).toBe(idle)
  })

  it('away 에서도 타이머는 계속 흐르고 away 시간만 따로 쌓인다 (AT-06)', () => {
    const next = tickSession(RUNNING(60000), 1000, 'away')

    expect(next.elapsedMs).toBe(1000)
    expect(next.awayMs).toBe(1000)
    expect(next.detectableMs).toBe(0)
  })

  it('unstable 시간은 감지 가능 시간에 포함되지 않는다 (AT-07)', () => {
    const next = tickSession(RUNNING(60000), 1000, 'unstable')

    expect(next.elapsedMs).toBe(1000)
    expect(next.unstableMs).toBe(1000)
    expect(next.detectableMs).toBe(0)
  })

  it('good 상태에서는 감지 가능 시간이 함께 쌓인다', () => {
    const next = tickSession(RUNNING(60000), 1000, 'good')

    expect(next.detectableMs).toBe(1000)
    expect(next.awayMs).toBe(0)
  })

  it('계획 시간에 도달하면 completed 로 바뀌고 초과하지 않는다', () => {
    const next = tickSession(RUNNING(3000), 5000, 'good')

    expect(next.status).toBe('completed')
    expect(next.elapsedMs).toBe(3000)
    expect(remainingMs(next)).toBe(0)
  })
})

describe('시간 표기', () => {
  it('타이머는 mm:ss 로 표시한다', () => {
    expect(formatClock(1500000)).toBe('25:00')
    expect(formatClock(0)).toBe('00:00')
  })

  it('요약은 사람이 읽는 형태로 표시한다', () => {
    expect(formatDuration(0)).toBe('0초')
    expect(formatDuration(90000)).toBe('1분 30초')
    expect(formatDuration(3660000)).toBe('1시간 1분')
  })
})
