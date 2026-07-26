import { clearLocal } from '@/lib/storage/local'
import { useUserStore } from '@/features/onboarding/userStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useGameStore } from '@/features/game/gameStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { resetRewardsForTest } from '@/features/game/rewards'
import { resetFinalizedForTest } from '@/features/sessions/finalizeSession'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import { resetContributionLedgerForTest } from '@/features/campus/recordContribution'
import { disposeCampus } from '@/features/campus/campusStore'
import { resetCampusMemberIdForTest } from '@/features/campus/identity'

/**
 * 전체 로컬 데이터 초기화 — 첫 방문 상태로 돌아갑니다.
 * 닉네임·개인 기준·세션 기록·XP·포인트·출석·구매/장착 아이템·환경 모드 삭제.
 * (카메라 영상·프레임·랜드마크 원본은 애초에 저장하지 않습니다)
 */
export function resetAllData(): void {
  clearLocal()

  useDemoStore.setState({ isDemo: false })
  useUserStore.getState().reset()
  useProgressionStore.getState().reset()
  useCalibrationStore.getState().clear()
  useCalibrationStore.getState().setSensitivity('default')
  useSessionHistoryStore.getState().clear()
  useSessionStore.getState().reset()
  useGameStore.getState().reset()
  usePostureStore.getState().reset()
  resetRewardsForTest()
  resetFinalizedForTest()

  // 캠퍼스 — 학교 선택·기여 원장·익명 식별자·저장소 연결을 함께 비웁니다.
  // 플래그가 꺼져 있어도 남은 값이 없도록 항상 호출합니다.
  useCampusThemeStore.getState().reset()
  resetContributionLedgerForTest()
  resetCampusMemberIdForTest()
  disposeCampus()

  // 스토어 reset 이 구독자를 통해 0 값을 다시 저장할 수 있으므로 한 번 더 비웁니다.
  clearLocal()
}
