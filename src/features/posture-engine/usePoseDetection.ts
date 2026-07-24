import { useEffect, useRef, useState } from 'react'
import { loadPoseLandmarker } from '@/lib/mediapipe/loader'
import { extractFeatures, type FeatureResult, type Landmark } from './features'

/**
 * 비디오 프레임에서 Pose 를 추론해 정규화 특징값을 콜백으로 넘깁니다. — docs/06 §14
 *
 * - 추론 빈도를 제한합니다(기본 ~12fps).
 * - 같은 프레임을 중복 처리하지 않습니다.
 * - 원본 프레임·랜드마크 시계열을 저장하지 않습니다. 각 프레임은 즉시 폐기됩니다.
 */
export interface PoseDetectionOptions {
  enabled: boolean
  fps?: number
  /** 매 추론마다 호출. 인물 미감지 시 null. */
  onResult: (result: FeatureResult | null) => void
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { enabled, fps = 12, onResult }: PoseDetectionOptions,
) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let rafId = 0
    let lastAt = 0
    let lastVideoTime = -1
    const minInterval = 1000 / fps

    const run = async () => {
      setModelStatus('loading')
      let landmarker
      try {
        landmarker = await loadPoseLandmarker()
      } catch {
        if (!cancelled) setModelStatus('error')
        return
      }
      if (cancelled) return
      setModelStatus('ready')

      const loop = () => {
        if (cancelled) return
        rafId = requestAnimationFrame(loop)

        const video = videoRef.current
        if (!video || video.readyState < 2) return

        const now = performance.now()
        if (now - lastAt < minInterval) return
        // 같은 프레임은 중복 처리하지 않습니다.
        if (video.currentTime === lastVideoTime) return
        lastAt = now
        lastVideoTime = video.currentTime

        try {
          const result = landmarker.detectForVideo(video, now)
          const landmarks = result.landmarks?.[0] as Landmark[] | undefined
          onResultRef.current(landmarks ? extractFeatures(landmarks) : null)
        } catch {
          onResultRef.current(null)
        }
      }
      loop()
    }

    run()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [enabled, fps, videoRef])

  return { modelStatus }
}
