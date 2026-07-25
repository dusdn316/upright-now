import { beforeEach, describe, expect, it } from 'vitest'
import { installPersistence } from './persist'
import { useUserStore } from '@/features/onboarding/userStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'

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

  it('상점·최근 XP까지 저장되어 새로고침 후 복원된다 (Gate 1)', () => {
    const uninstall = installPersistence()

    useProgressionStore.setState({ points: 300 })
    useProgressionStore.getState().purchaseItem('jacket-navy', 100)
    useProgressionStore.getState().equipItem('jacket', 'jacket-navy')
    useProgressionStore.getState().logXpGain('스트레칭', 20)

    const saved = loadLocal<{
      points: number
      inventory: string[]
      equipped: { jacketId?: string }
      recentXp: Array<{ label: string; xp: number }>
    }>(STORAGE_KEYS.progression, {
      points: -1,
      inventory: [],
      equipped: {},
      recentXp: [],
    })

    expect(saved.points).toBe(200)
    expect(saved.inventory).toContain('jacket-navy')
    expect(saved.equipped.jacketId).toBe('jacket-navy')
    expect(saved.recentXp[0]).toMatchObject({ label: '스트레칭', xp: 20 })
    uninstall()
  })

  it('설정(민감도)이 저장·복원된다 (Gate 1)', () => {
    const uninstall = installPersistence()
    useCalibrationStore.getState().setSensitivity('gentle')

    const saved = loadLocal<{ sensitivity: string }>(STORAGE_KEYS.calibration, {
      sensitivity: '',
    })
    expect(saved.sensitivity).toBe('gentle')
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
