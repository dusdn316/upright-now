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
import { useModeStore } from '@/features/modes/modeStore'

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
  useModeStore.getState().reset()
  resetRewardsForTest()
  resetFinalizedForTest()

  // 캠퍼스 — 학교 선택·기여 원장·익명 식별자·저장소 연결을 함께 비웁니다.
  // 플래그가 꺼져 있어도 남은 값이 없도록 항상 호출합니다.
  useCampusThemeStore.getState().reset()
  resetContributionLedgerForTest()
  resetCampusMemberIdForTest()
  disposeCampus()
  // 주의: mock 영토 저장소(resetMockCampusForTest)는 여기서 비우지 않습니다.
  // mock 은 서버 역할이라 초기화 후에도 eventId 를 기억해 같은 이벤트의
  // 중복 적립을 막아야 합니다 (recordContribution.spec 이 이 동작을 고정).

  // 스토어 reset 이 구독자를 통해 0 값을 다시 저장할 수 있으므로 한 번 더 비웁니다.
  clearLocal()
}
