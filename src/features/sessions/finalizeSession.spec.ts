import { beforeEach, describe, expect, it } from 'vitest'
import { finalizeSession, resetFinalizedForTest } from './finalizeSession'
import { useSessionStore } from './sessionStore'
import { useSessionHistoryStore } from './sessionHistoryStore'
import { useGameStore } from '@/features/game/gameStore'
import { resetRewardsForTest } from '@/features/game/rewards'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useDemoStore } from '@/features/demo/demoMode'

function seedSession(elapsedMs: number, plannedMs = 1_500_000) {
  useSessionStore.setState({
    sessionId: 's-test',
    status: 'running',
    plannedMs,
    elapsedMs,
    detectableMs: elapsedMs,
    awayMs: 0,
    unstableMs: 0,
    subject: '테스트',
    goal: '',
  })
}

describe('finalizeSession — atomic 세션 종료 (긴급 안정화 F)', () => {
  beforeEach(() => {
    resetFinalizedForTest()
    resetRewardsForTest()
    useDemoStore.getState().disableDemo()
    useGameStore.getState().reset()
    useSessionHistoryStore.getState().clear()
    useProgressionStore.setState({
      xp: 0,
      points: 0,
      attendance: [],
      completedSessions: 0,
    })
  })

  it('타이머 정상 종료 → 완료 보상·출석·기록이 한 번에 갱신된다', () => {
    seedSession(1_500_000)
    const result = finalizeSession('timer')

    expect(result.completed).toBe(true)
    const prog = useProgressionStore.getState()
    expect(prog.xp).toBe(100)
    expect(prog.points).toBe(100)
    expect(prog.completedSessions).toBe(1)
    expect(prog.attendance).toHaveLength(1)
    expect(useSessionHistoryStore.getState().summaries).toHaveLength(1)
    expect(useSessionStore.getState().status).toBe('completed')
  })

  it('계획의 80% 이상 진행 후 수동 종료도 완료로 인정한다', () => {
    seedSession(1_500_000 * 0.85)
    const result = finalizeSession('manual')

    expect(result.completed).toBe(true)
    expect(useProgressionStore.getState().completedSessions).toBe(1)
  })

  it('17초 중도 종료는 완료 세션·출석·완주 보상에 포함되지 않는다', () => {
    seedSession(17_000)
    const result = finalizeSession('manual')

    expect(result.completed).toBe(false)
    const prog = useProgressionStore.getState()
    expect(prog.xp).toBe(0)
    expect(prog.points).toBe(0)
    expect(prog.completedSessions).toBe(0)
    expect(prog.attendance).toHaveLength(0)
    // 기록 자체는 남는다 (중도 종료로 표시)
    expect(useSessionHistoryStore.getState().summaries[0]?.status).toBe('aborted')
    expect(useSessionStore.getState().status).toBe('aborted')
  })

  it('같은 sessionId 로 두 번 종료해도 보상은 1회다', () => {
    seedSession(1_500_000)
    finalizeSession('timer')
    const second = finalizeSession('manual')

    expect(second.alreadyFinalized).toBe(true)
    expect(useProgressionStore.getState().xp).toBe(100)
    expect(useProgressionStore.getState().completedSessions).toBe(1)
    expect(useSessionHistoryStore.getState().summaries).toHaveLength(1)
  })

  it('세션을 다시 시작하면 종료 잠금이 풀린다', () => {
    seedSession(1_500_000)
    finalizeSession('timer')

    useSessionStore.getState().start('s-test')
    seedSession(1_500_000)
    finalizeSession('timer')

    expect(useProgressionStore.getState().completedSessions).toBe(2)
  })

  it('데모 모드에서는 출석·완료 수·기록을 남기지 않는다', () => {
    useDemoStore.getState().enableDemo()
    seedSession(180_000, 180_000)
    finalizeSession('timer')

    expect(useProgressionStore.getState().completedSessions).toBe(0)
    expect(useSessionHistoryStore.getState().summaries).toHaveLength(0)
  })
})
