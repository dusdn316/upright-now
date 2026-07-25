import { beforeEach, describe, expect, it } from 'vitest'
import { resetAllData } from './dataReset'
import { useUserStore } from '@/features/onboarding/userStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { installPersistence } from '@/features/persistence/persist'
import { makeProfile } from '@/features/posture-engine/testFixtures'
import { applyReward, resetRewardsForTest } from '@/features/game/rewards'

describe('전체 로컬 데이터 초기화 (Gate 1)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRewardsForTest()
  })

  it('닉네임·기준·기록·XP·포인트·출석·아이템·모드가 모두 삭제된다', () => {
    const uninstall = installPersistence()

    // 실제 사용 상황을 만든다
    useUserStore.getState().setNickname('수현')
    useUserStore.getState().setProfile('team')
    useCalibrationStore.getState().setProfile(makeProfile())
    useCalibrationStore.getState().setSensitivity('sensitive')
    applyReward({ id: 'c1', sessionId: 's1', type: 'session_completed' })
    useProgressionStore.getState().completeSessionMark('2026-07-25')
    useProgressionStore.getState().purchaseItem('jacket-navy', 100)
    useProgressionStore.getState().equipItem('jacket', 'jacket-navy')
    useSessionHistoryStore.getState().add({
      id: 'sum-1',
      startedAt: 1,
      endedAt: 2,
      status: 'completed',
      plannedDurationMs: 1,
      elapsedMs: 1,
      detectableMs: 1,
      awayMs: 0,
      unstableMs: 0,
      recoveryOpportunities: 0,
      recoveries: 0,
      bestCombo: 0,
      damageDealt: 0,
      xpEarned: 0,
      pointsEarned: 0,
    })

    resetAllData()

    // 스토어가 첫 방문 상태다
    expect(useUserStore.getState().hasOnboarded).toBe(false)
    expect(useUserStore.getState().nickname).toBe('익명의 기린')
    expect(useUserStore.getState().profileId).toBe('library')
    expect(useCalibrationStore.getState().profile).toBeNull()
    expect(useCalibrationStore.getState().sensitivity).toBe('default')
    const prog = useProgressionStore.getState()
    expect(prog.xp).toBe(0)
    expect(prog.points).toBe(0)
    expect(prog.attendance).toHaveLength(0)
    expect(prog.completedSessions).toBe(0)
    expect(prog.inventory).toHaveLength(0)
    expect(prog.equipped).toEqual({})
    expect(prog.recentXp).toHaveLength(0)
    expect(useSessionHistoryStore.getState().summaries).toHaveLength(0)

    // localStorage 네임스페이스도 비어 있다
    const leftover = Object.keys(localStorage).filter((k) =>
      k.startsWith('upright-now:'),
    )
    expect(leftover).toHaveLength(0)

    uninstall()
  })
})
