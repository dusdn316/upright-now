import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { DAMAGE } from '@/constants/game'

describe('gameStore — 전투·콤보 (XP 는 rewards 가 담당)', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  it('회복 성공 1회 → 특수 공격 · 콤보 +1', () => {
    const before = useGameStore.getState().boss.hp
    const result = useGameStore.getState().recoverySucceeded('r-1')
    const after = useGameStore.getState()

    expect(result.applied).toBe(DAMAGE.recovery)
    expect(after.boss.hp).toBe(before - DAMAGE.recovery)
    expect(after.combo).toBe(1)
    expect(after.recoveries).toBe(1)
    expect(after.attackTick).toBe(1)
  })

  it('같은 이벤트가 두 번 와도 피해·콤보는 1회다 (AT-05)', () => {
    useGameStore.getState().recoverySucceeded('r-1')
    useGameStore.getState().recoverySucceeded('r-1')
    const state = useGameStore.getState()

    expect(state.recoveries).toBe(1)
    expect(state.combo).toBe(1)
    expect(state.boss.hp).toBe(1000 - DAMAGE.recovery)
  })

  it('가장 빠른 회복 시간이 기록된다', () => {
    useGameStore.getState().registerOpportunity(1000)
    useGameStore.getState().recoverySucceeded('r-1', 7500)
    expect(useGameStore.getState().fastestRecoveryMs).toBe(6500)

    useGameStore.getState().registerOpportunity(10_000)
    useGameStore.getState().recoverySucceeded('r-2', 12_000)
    expect(useGameStore.getState().fastestRecoveryMs).toBe(2000)
  })

  it('회복 기회를 놓치면 현재 콤보만 0이 된다', () => {
    useGameStore.getState().recoverySucceeded('r-1')
    useGameStore.getState().recoveryMissed()
    const state = useGameStore.getState()

    expect(state.combo).toBe(0)
    expect(state.bestCombo).toBe(1)
  })

  it('세션 완주는 기본 공격을 한 번만 준다', () => {
    useGameStore.getState().sessionCompleted('s-1')
    const first = useGameStore.getState().boss.hp
    useGameStore.getState().sessionCompleted('s-1')

    expect(first).toBe(1000 - DAMAGE.sessionCompleted)
    expect(useGameStore.getState().boss.hp).toBe(first)
  })

  it('addSessionEarnings 는 화면 집계만 올린다', () => {
    useGameStore.getState().addSessionEarnings(30, 10)
    useGameStore.getState().addSessionEarnings(100, 100)

    expect(useGameStore.getState().sessionXp).toBe(130)
    expect(useGameStore.getState().sessionPoints).toBe(110)
  })
})
