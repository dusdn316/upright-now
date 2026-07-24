import { medianFeatures, stdevFeatures, type FeatureResult } from '@/features/posture-engine/features'
import type { CalibrationProfile } from './calibrationStore'

/**
 * 5초 캘리브레이션 표본 수집 — 순수 로직. 시간은 호출자가 넘깁니다. (docs/06 §6)
 *
 * 아래 상황에서는 진행을 초기화하고 저장하지 않습니다.
 * - 사람 미감지 / 얼굴·어깨 가시성 부족 (usable=false)
 * - 큰 움직임 (직전 표본과 크게 다름)
 */
export const CALIBRATION_DURATION_MS = 5000
const MOVEMENT_LIMIT = 0.25 // 직전 표본 대비 허용 변화

export type CalibrationQuality =
  | 'ok'
  | 'no-person'
  | 'low-visibility'
  | 'moving'
  | 'idle'

export interface CollectState {
  samples: FeatureResult['features'][]
  visibilitySum: number
  startedAt: number | null
}

export interface CollectResult {
  state: CollectState
  quality: CalibrationQuality
  /** 0~1 */
  progress: number
  /** 완료 시 저장할 프로필. 아직이면 null. */
  profile: CalibrationProfile | null
}

export function createCollectState(): CollectState {
  return { samples: [], visibilitySum: 0, startedAt: null }
}

function movedTooMuch(
  next: FeatureResult['features'],
  prev: FeatureResult['features'] | undefined,
): boolean {
  if (!prev) return false
  return (
    Math.abs(next.faceWidth - prev.faceWidth) > MOVEMENT_LIMIT ||
    Math.abs(next.headOffsetX - prev.headOffsetX) > MOVEMENT_LIMIT ||
    Math.abs(next.headOffsetY - prev.headOffsetY) > MOVEMENT_LIMIT
  )
}

export function collectStep(
  state: CollectState,
  input: { result: FeatureResult | null; now: number; profileName?: string },
): CollectResult {
  const { result, now, profileName = '기본 자세' } = input
  const reset = createCollectState()

  // 사람 미감지
  if (!result) {
    return { state: reset, quality: 'no-person', progress: 0, profile: null }
  }
  // 얼굴·어깨 가시성 부족 또는 프레임에서 잘림
  if (!result.usable) {
    return { state: reset, quality: 'low-visibility', progress: 0, profile: null }
  }
  // 큰 움직임 → 초기화
  if (movedTooMuch(result.features, state.samples.at(-1))) {
    return { state: reset, quality: 'moving', progress: 0, profile: null }
  }

  const startedAt = state.startedAt ?? now
  const samples = [...state.samples, result.features]
  const visibilitySum = state.visibilitySum + result.visibility
  const elapsed = now - startedAt
  const progress = Math.min(1, elapsed / CALIBRATION_DURATION_MS)

  const nextState: CollectState = { samples, visibilitySum, startedAt }

  if (elapsed >= CALIBRATION_DURATION_MS && samples.length >= 3) {
    const baseline = medianFeatures(samples)
    const variance = stdevFeatures(samples, baseline)
    const profile: CalibrationProfile = {
      id: `cal-${Math.round(now)}`,
      name: profileName,
      createdAt: Date.now(),
      baseline,
      variance,
      quality: {
        sampleCount: samples.length,
        meanVisibility: visibilitySum / samples.length,
      },
    }
    return { state: reset, quality: 'ok', progress: 1, profile }
  }

  return { state: nextState, quality: 'ok', progress, profile: null }
}
