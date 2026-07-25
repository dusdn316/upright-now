import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './sessionStore'
import { useSessionHistoryStore } from './sessionHistoryStore'
import { buildSessionSummary } from './buildSummary'
import { resetFinalizedForTest } from './finalizeSession'
import { useGameStore } from '@/features/game/gameStore'

/**
 * 세션 중 스트레칭(resting) — 스트레칭은 세션을 끝내지 않습니다.
 * active-session 출발 스트레칭은 beginRest → (스트레칭) → endRest 로
 * 같은 세션에 복귀하고, 그동안 타이머는 흐르지 않습니다.
 */
describe('세션 중 스트레칭 일시정지 (resting)', () => {
  beforeEach(() => {
    resetFinalizedForTest()
    useSessionStore.getState().reset()
    useSessionHistoryStore.getState().clear()
  })

  it('start 는 실제 시작 시각을 기록한다', () => {
    const before = Date.now()
    useSessionStore.getState().start('s-rest')
    const s = useSessionStore.getState()
    expect(s.status).toBe('running')
    expect(s.startedAt).toBeGreaterThanOrEqual(before)
  })

  it('beginRest 동안 타이머가 흐르지 않고, endRest 후 이어서 흐른다', () => {
    const store = useSessionStore.getState()
    store.start('s-rest')
    store.tick(10_000, 'good')
    expect(useSessionStore.getState().elapsedMs).toBe(10_000)

    useSessionStore.getState().beginRest()
    expect(useSessionStore.getState().status).toBe('resting')
    useSessionStore.getState().tick(120_000, 'good')
    // 스트레칭 2분 동안 세션 시간은 그대로
    expect(useSessionStore.getState().elapsedMs).toBe(10_000)

    useSessionStore.getState().endRest()
    expect(useSessionStore.getState().status).toBe('running')
    useSessionStore.getState().tick(5_000, 'good')
    expect(useSessionStore.getState().elapsedMs).toBe(15_000)
  })

  it('beginRest 는 활성 세션에서만 동작한다 (idle 은 그대로)', () => {
    useSessionStore.getState().beginRest()
    expect(useSessionStore.getState().status).toBe('idle')
  })

  it('요약에는 원본 sessionId 와 실제 시작 시각이 남는다', () => {
    useSessionStore.getState().start('s-summary')
    useSessionStore.getState().tick(17_000, 'good')
    const startedAt = useSessionStore.getState().startedAt

    const summary = buildSessionSummary(
      useSessionStore.getState(),
      useGameStore.getState(),
      'aborted',
    )
    expect(summary.sessionId).toBe('s-summary')
    // 역산(now - elapsed)이 아니라 start() 시각을 그대로 씁니다.
    expect(summary.startedAt).toBe(startedAt)
    expect(summary.elapsedMs).toBe(17_000)
  })
})
