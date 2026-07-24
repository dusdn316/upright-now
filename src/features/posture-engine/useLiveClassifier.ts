import { useEffect, useRef } from 'react'
import { useCamera } from '@/features/calibration/useCamera'
import { usePoseDetection, type ModelStatus } from './usePoseDetection'
import { classify, computeDeviation, emaUpdate } from './classify'
import { usePostureStore } from './postureStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import type { PostureState } from '@/types'
import type { FeatureResult } from './features'

/**
 * 카메라 + Pose + 분류를 하나로 묶어 postureStore.setInstant 에 순간 상태를 넣습니다.
 *
 * MediaPipe → 특징값 → 개인 기준 편차 → 분류 → postureStore 의 마지막 연결부입니다.
 * 인물 미감지가 이어지면 away, 감지 품질이 낮으면 unstable 을 넣습니다.
 */
const AWAY_FRAMES = 8 // 연속 미감지 프레임 → away

export function useLiveClassifier(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  cameraState: ReturnType<typeof useCamera>['state'],
): { modelStatus: ModelStatus } {
  const profile = useCalibrationStore((s) => s.profile)
  const sensitivity = useCalibrationStore((s) => s.sensitivity)
  const scoreRef = useRef(0)
  const stateRef = useRef<PostureState>('unstable')
  const missRef = useRef(0)

  const enabled = cameraState.status === 'ready'

  const { modelStatus } = usePoseDetection(videoRef, {
    enabled,
    onResult: (result: FeatureResult | null) => {
      const setInstant = usePostureStore.getState().setInstant

      // 인물 미감지
      if (!result) {
        missRef.current += 1
        if (missRef.current >= AWAY_FRAMES) {
          stateRef.current = 'away'
          setInstant('away')
        }
        return
      }
      missRef.current = 0

      // 감지 품질 낮음 → unstable
      if (!result.usable) {
        stateRef.current = 'unstable'
        setInstant('unstable')
        return
      }

      // 기준이 없으면 아직 판정하지 않습니다.
      if (!profile) {
        stateRef.current = 'unstable'
        setInstant('unstable')
        return
      }

      const { score } = computeDeviation(result.features, profile)
      scoreRef.current = emaUpdate(scoreRef.current, score)
      const next = classify(scoreRef.current, stateRef.current, sensitivity)
      stateRef.current = next
      setInstant(next)
    },
  })

  // 카메라가 꺼지면 다음 세션을 위해 스무딩 상태를 초기화합니다.
  useEffect(() => {
    if (!enabled) {
      scoreRef.current = 0
      stateRef.current = 'unstable'
      missRef.current = 0
    }
  }, [enabled])

  return { modelStatus }
}
