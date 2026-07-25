import { saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { useUserStore } from '@/features/onboarding/userStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { useDemoStore } from '@/features/demo/demoMode'

/**
 * 스토어 변경을 localStorage 에 반영합니다.
 * 데모 모드(isDemo)에서는 저장하지 않아 데모 값이 실제 데이터로 새지 않습니다.
 */
export function installPersistence(): () => void {
  const guard = (fn: () => void) => {
    if (useDemoStore.getState().isDemo) return
    fn()
  }

  const unsubUser = useUserStore.subscribe((s) =>
    guard(() =>
      saveLocal(STORAGE_KEYS.user, {
        nickname: s.nickname,
        hasOnboarded: s.hasOnboarded,
        profileId: s.profileId,
        hasCalibration: s.hasCalibration,
        soundEnabled: s.soundEnabled,
        pipAutoOpen: s.pipAutoOpen,
      }),
    ),
  )

  const unsubProgress = useProgressionStore.subscribe((s) =>
    guard(() =>
      saveLocal(STORAGE_KEYS.progression, {
        xp: s.xp,
        points: s.points,
        attendance: s.attendance,
        completedSessions: s.completedSessions,
        inventory: s.inventory,
        equipped: s.equipped,
        shopUnlocked: s.shopUnlocked,
        recentXp: s.recentXp,
      }),
    ),
  )

  const unsubCal = useCalibrationStore.subscribe((s) =>
    guard(() =>
      saveLocal(STORAGE_KEYS.calibration, {
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        sensitivity: s.sensitivity,
      }),
    ),
  )

  const unsubSessions = useSessionHistoryStore.subscribe((s) =>
    guard(() => saveLocal(STORAGE_KEYS.sessions, s.summaries)),
  )

  return () => {
    unsubUser()
    unsubProgress()
    unsubCal()
    unsubSessions()
  }
}
