import { beforeEach, describe, expect, it } from 'vitest'
import { installPersistence } from './persist'
import { useUserStore } from '@/features/onboarding/userStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'

describe('영속화 — 실제 값만 저장, 데모 값은 저장 안 함', () => {
  beforeEach(() => {
    localStorage.clear()
    useDemoStore.getState().disableDemo()
    useProgressionStore.setState({ xp: 0, points: 0 })
  })

  it('실제 사용자 변경은 localStorage 에 저장된다', () => {
    const uninstall = installPersistence()
    useUserStore.getState().setNickname('수현')
    useProgressionStore.getState().addXp(30)

    const user = loadLocal<{ nickname: string }>(STORAGE_KEYS.user, {
      nickname: '',
    })
    const prog = loadLocal<{ xp: number }>(STORAGE_KEYS.progression, { xp: -1 })

    expect(user.nickname).toBe('수현')
    expect(prog.xp).toBe(30)
    uninstall()
  })

  it('데모 모드에서는 저장하지 않는다', () => {
    const uninstall = installPersistence()
    useDemoStore.getState().enableDemo() // xp 700, nickname 데모 기린

    // 데모로 바뀐 값이 저장되지 않아야 한다.
    const prog = loadLocal<{ xp: number } | null>(STORAGE_KEYS.progression, null)
    expect(prog).toBeNull()
    uninstall()
  })
})
