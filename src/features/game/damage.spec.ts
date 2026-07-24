import { describe, expect, it } from 'vitest'
import { applyDamage, createBossState } from './damage'

describe('applyDamage — 같은 회복 이벤트로 두 번 피해를 주지 않는다', () => {
  it('처음 적용되면 HP가 줄어든다', () => {
    const boss = createBossState(1000)
    const result = applyDamage(boss, { eventId: 'r-1', amount: 40 })

    expect(result.state.hp).toBe(960)
    expect(result.applied).toBe(40)
  })

  it('같은 eventId 를 다시 적용해도 HP가 그대로다 (AT-05)', () => {
    const boss = createBossState(1000)
    const once = applyDamage(boss, { eventId: 'r-1', amount: 40 })
    const twice = applyDamage(once.state, { eventId: 'r-1', amount: 40 })

    expect(twice.state.hp).toBe(960)
    expect(twice.applied).toBe(0)
  })

  it('HP는 0 아래로 내려가지 않는다', () => {
    const boss = createBossState(30)
    const result = applyDamage(boss, { eventId: 'r-1', amount: 100 })

    expect(result.state.hp).toBe(0)
    expect(result.applied).toBe(30)
  })

  it('원본 상태를 변경하지 않는다', () => {
    const boss = createBossState(1000)
    applyDamage(boss, { eventId: 'r-1', amount: 40 })

    expect(boss.hp).toBe(1000)
    expect(boss.processedEventIds).toHaveLength(0)
  })
})
