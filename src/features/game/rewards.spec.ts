import { beforeEach, describe, expect, it } from 'vitest'
import { applyReward, resetRewardsForTest } from './rewards'
import { useGameStore } from './gameStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'

describe('applyReward — 보상 단일 진입점 (긴급 안정화 F)', () => {
  beforeEach(() => {
    resetRewardsForTest()
    useGameStore.getState().reset()
    useProgressionStore.setState({ xp: 0, points: 0 })
  })

  it('보상표대로 적립된다', () => {
    expect(
      applyReward({ id: 'r1', sessionId: 's1', type: 'recovery_success' }),
    ).toMatchObject({ applied: true, xp: 30, points: 10 })
    expect(
      applyReward({ id: 'c1', sessionId: 's1', type: 'session_completed' }),
    ).toMatchObject({ xp: 100, points: 100 })
    expect(
      applyReward({ id: 'st1', sessionId: 's1', type: 'stretch_completed' }),
    ).toMatchObject({ xp: 20, points: 20 })
    expect(
      applyReward({ id: 'g1', sessionId: 's1', type: 'goal_completed' }),
    ).toMatchObject({ xp: 20, points: 20 })

    expect(useProgressionStore.getState().xp).toBe(30 + 100 + 20 + 20)
    expect(useProgressionStore.getState().points).toBe(10 + 100 + 20 + 20)
  })

  it('동일 id 는 두 번 적용되지 않는다', () => {
    applyReward({ id: 'dup', sessionId: 's1', type: 'session_completed' })
    const second = applyReward({ id: 'dup', sessionId: 's1', type: 'session_completed' })

    expect(second.applied).toBe(false)
    expect(useProgressionStore.getState().xp).toBe(100)
  })

  it('recovery XP 반영은 세션당 최대 5회 — 이후에는 0 지급(capped)', () => {
    for (let i = 0; i < MAX_REWARDED_RECOVERIES; i += 1) {
      const r = applyReward({ id: `r-${i}`, sessionId: 's1', type: 'recovery_success' })
      expect(r.xp).toBe(30)
    }
    const sixth = applyReward({ id: 'r-6', sessionId: 's1', type: 'recovery_success' })
    expect(sixth.applied).toBe(true)
    expect(sixth.capped).toBe(true)
    expect(sixth.xp).toBe(0)

    expect(useProgressionStore.getState().xp).toBe(30 * MAX_REWARDED_RECOVERIES)
  })

  it('상한은 세션 단위다 — 다른 세션에서는 다시 지급된다', () => {
    for (let i = 0; i < MAX_REWARDED_RECOVERIES + 1; i += 1) {
      applyReward({ id: `a-${i}`, sessionId: 's1', type: 'recovery_success' })
    }
    const other = applyReward({ id: 'b-0', sessionId: 's2', type: 'recovery_success' })
    expect(other.xp).toBe(30)
  })

  it('같은 스트레칭 완료 이벤트 id 는 1회만 보상된다 (Gate 1)', () => {
    const id = 'stretch-s1-shoulder-roll-1'
    const first = applyReward({ id, sessionId: 's1', type: 'stretch_completed' })
    const second = applyReward({ id, sessionId: 's1', type: 'stretch_completed' })

    expect(first).toMatchObject({ applied: true, xp: 20, points: 20 })
    expect(second.applied).toBe(false)
    expect(useProgressionStore.getState().xp).toBe(20)
    expect(useProgressionStore.getState().points).toBe(20)
  })

  it('XP 획득이 최근 목록(최대 5개)에 남는다 (Gate 1)', () => {
    useProgressionStore.setState({ recentXp: [] })
    for (let i = 0; i < 7; i += 1) {
      applyReward({ id: `g-${i}`, sessionId: 's1', type: 'goal_completed' })
    }
    // goal 은 세션당 1회 제약이 없고 id 만 다르면 적립됩니다 (Result 에서 세션당 1회 강제)
    const recent = useProgressionStore.getState().recentXp
    expect(recent.length).toBeLessThanOrEqual(5)
    expect(recent[0].label).toBe('목표 완료')
  })

  it('세션 화면 집계(sessionXp)는 recovery·완료 보상에서만 오른다', () => {
    applyReward({ id: 'r1', sessionId: 's1', type: 'recovery_success' })
    applyReward({ id: 'g1', sessionId: 's1', type: 'goal_completed' })

    expect(useGameStore.getState().sessionXp).toBe(30)
    expect(useGameStore.getState().sessionPoints).toBe(10)
  })
})
