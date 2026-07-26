import { featureFlags } from '@/lib/feature-flags/flags'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { useQaFlagsStore } from './qaFlagsStore'
import { usePipStore } from '@/features/pip/pipStore'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import { CHARACTER_STAGES } from '@/constants/game'
import type { CharacterStage, PostureState } from '@/types'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { useRoomStore } from '@/features/rooms/roomStore'
import { makeProfile } from '@/features/posture-engine/testFixtures'

/**
 * 개발·E2E 전용 조작 API.
 *
 * 사용자 화면에는 개발용 위젯을 두지 않기 위해, 상태 주입은
 * QA Lab(`/lab`) 화면과 이 window API 두 곳으로만 제공합니다.
 * QA Lab 플래그가 꺼진 빌드에서는 설치되지 않습니다.
 */
export interface UprightDevApi {
  setPosture: (state: PostureState) => void
  startRecovery: () => void
  /** 자세를 회복하는 중 (recover 이미지) */
  showRecovering: () => void
  recoverySuccess: () => void
  recoveryMissed: () => void
  startSession: (sessionId?: string) => void
  completeSession: () => void
  setStage: (stage: CharacterStage) => void
  enableDemo: () => void
  /** e2e 용 — 세션·스트레칭 타이머 배속 */
  setTimeScale: (scale: number) => void
  /** 캐릭터 이미지 로딩 실패 상황을 흉내 냅니다. (SVG 폴백 확인용) */
  setImagesBroken: (value: boolean) => void
  reset: () => void
  /** PiP 상태 조회 (e2e 검증용) */
  getPipState: () => { open: boolean; fallback: boolean }
  /** e2e 용 — 합성 자세 기준 주입 + 카메라 준비 플래그 */
  injectTestCalibration: () => void
  /** e2e 진단용 — 방 반응 수신 상태 */
  getRoomDebug: () => { reactions: number; phase: string; connection: string }
}

declare global {
  interface Window {
    __upright?: UprightDevApi
  }
}

export function createDevApi(): UprightDevApi {
  return {
    setPosture: (state) => {
      useCharacterVisualStore.getState().setIntent(null)
      usePostureStore.getState().setPostureState(state)
    },

    startRecovery: () => {
      usePostureStore.getState().setPostureState('bad')
      usePostureStore.getState().emitEvent('recovery_started')
    },

    showRecovering: () => {
      usePostureStore.getState().setPostureState('good')
      useCharacterVisualStore.getState().setIntent('recover')
    },

    recoverySuccess: () => {
      usePostureStore.getState().setPostureState('good')
      usePostureStore.getState().emitEvent('recovery_succeeded')
    },

    recoveryMissed: () => usePostureStore.getState().emitEvent('recovery_missed'),

    startSession: (sessionId = 'demo') => {
      useGameStore.getState().reset()
      useSessionStore.getState().start(sessionId)
    },

    completeSession: () => useSessionStore.getState().completeNow(),

    setStage: (stage) =>
      useProgressionStore.setState({
        xp: CHARACTER_STAGES[stage - 1].requiredXp,
      }),

    enableDemo: () => useDemoStore.getState().enableDemo(),

    setTimeScale: (scale) => useSessionStore.getState().setTimeScale(scale),

    setImagesBroken: (value) =>
      useQaFlagsStore.getState().setCharacterImagesBroken(value),

    getRoomDebug: () => ({
      reactions: useRoomStore.getState().reactions.length,
      phase: useRoomStore.getState().phase,
      connection: useRoomStore.getState().connection,
    }),

    injectTestCalibration: () => {
      useCalibrationStore.getState().addProfile(makeProfile())
      useUserStore.getState().setCalibrated(true)
      useRoomStore.getState().patch({ myCameraReady: true })
    },

    getPipState: () => ({
      open: usePipStore.getState().pipOpen,
      fallback: usePipStore.getState().fallbackActive,
    }),

    reset: () => {
      useGameStore.getState().reset()
      usePostureStore.getState().reset()
      useSessionStore.getState().reset()
      useCharacterVisualStore.getState().setIntent(null)
      useQaFlagsStore.getState().setCharacterImagesBroken(false)
    },
  }
}

export function installDevApi(): void {
  if (!featureFlags.qaLab || typeof window === 'undefined') return
  window.__upright = createDevApi()
}
