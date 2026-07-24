import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_NICKNAME, DEMO_PROGRESSION, hasDemoQuery, useDemoStore } from './demoMode'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { xpToStage } from '@/features/progression/growth'

describe('데모 값과 실제 사용자 값 분리', () => {
  beforeEach(() => {
    useDemoStore.getState().disableDemo()
  })

  it('실제 사용자 기본값은 XP 0 · 포인트 0 · Lv.1 이다', () => {
    const { xp, points } = useProgressionStore.getState()

    expect(xp).toBe(0)
    expect(points).toBe(0)
    expect(xpToStage(xp)).toBe(1)
    expect(useDemoStore.getState().isDemo).toBe(false)
  })

  it('데모에 명시적으로 진입할 때만 XP 700 · Lv.3 이 된다', () => {
    useDemoStore.getState().enableDemo()
    const { xp, points } = useProgressionStore.getState()

    expect(xp).toBe(DEMO_PROGRESSION.xp)
    expect(points).toBe(DEMO_PROGRESSION.points)
    expect(xpToStage(xp)).toBe(3)
    expect(useUserStore.getState().nickname).toBe(DEMO_NICKNAME)
    expect(useDemoStore.getState().isDemo).toBe(true)
  })

  it('데모를 끄면 실제 사용자 기본값으로 돌아간다', () => {
    useDemoStore.getState().enableDemo()
    useDemoStore.getState().disableDemo()

    expect(useProgressionStore.getState().xp).toBe(0)
    expect(useProgressionStore.getState().points).toBe(0)
    expect(useUserStore.getState().hasOnboarded).toBe(false)
  })
})

describe('hasDemoQuery', () => {
  it.each(['?demo=1', '?demo=true', '?foo=1&demo=1'])('%s → 데모', (search) => {
    expect(hasDemoQuery(search)).toBe(true)
  })

  it.each(['', '?demo=0', '?demo=', '?other=1'])('%s → 일반 진입', (search) => {
    expect(hasDemoQuery(search)).toBe(false)
  })
})
