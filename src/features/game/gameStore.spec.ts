import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'
import { DAMAGE, REWARD } from '@/constants/game'

describe('gameStore — 회복 보상 규칙 (docs/07 §12)', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  it('회복 성공 1회 → 특수 공격 · 콤보 +1 · XP 지급', () => {
    const before = useGameStore.getState().boss.hp
    const result = useGameStore.getState().recoverySucceeded('r-1')
    const after = useGameStore.getState()

    expect(result.applied).toBe(DAMAGE.recovery)
    expect(after.boss.hp).toBe(before - DAMAGE.recovery)
    expect(after.combo).toBe(1)
    expect(after.recoveries).toBe(1)
    expect(after.sessionXp).toBe(REWARD.recovery.xp)
    expect(after.attackTick).toBe(1)
  })

  it('같은 이벤트가 두 번 와도 보상은 1회다 (AT-05)', () => {
    useGameStore.getState().recoverySucceeded('r-1')
    useGameStore.getState().recoverySucceeded('r-1')
    const state = useGameStore.getState()

    expect(state.recoveries).toBe(1)
    expect(state.combo).toBe(1)
    expect(state.sessionXp).toBe(REWARD.recovery.xp)
  })

  it('세션당 XP 추가 지급은 상한이 있다', () => {
    for (let i = 0; i < MAX_REWARDED_RECOVERIES + 2; i += 1) {
      useGameStore.getState().recoverySucceeded(`r-${i}`)
    }
    const state = useGameStore.getState()

    expect(state.recoveries).toBe(MAX_REWARDED_RECOVERIES + 2)
    expect(state.sessionXp).toBe(REWARD.recovery.xp * MAX_REWARDED_RECOVERIES)
  })

  it('회복 기회를 놓치면 현재 콤보만 0이 되고 XP는 줄지 않는다', () => {
    useGameStore.getState().recoverySucceeded('r-1')
    useGameStore.getState().recoveryMissed()
    const state = useGameStore.getState()

    expect(state.combo).toBe(0)
    expect(state.bestCombo).toBe(1)
    expect(state.sessionXp).toBe(REWARD.recovery.xp)
  })

  it('세션 완주는 기본 공격을 한 번만 준다', () => {
    useGameStore.getState().sessionCompleted('s-1')
    const first = useGameStore.getState().boss.hp
    useGameStore.getState().sessionCompleted('s-1')

    expect(first).toBe(1000 - DAMAGE.sessionCompleted)
    expect(useGameStore.getState().boss.hp).toBe(first)
  })
})
