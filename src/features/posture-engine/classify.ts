import type {
  CalibrationProfile,
  FeatureVector,
} from '@/features/calibration/calibrationStore'
import type { Sensitivity } from '@/constants/posture'
import type { DeviationCategory, PostureState } from '@/types'

/**
 * 개인 기준 대비 편차 → 순간 자세 분류 — docs/06 §5, §9
 *
 * 평균이 아니라 축별 이탈의 최댓값을 씁니다. 고개를 푹 숙이는 것처럼 한 신호만
 * 급변하는 자세가 평균에 희석되지 않도록 하기 위함입니다.
 * (기존 프로토타입 검증에서 확인된 설계)
 *
 * 히스테리시스: warning/bad 진입 임계값과 복귀 임계값을 다르게 둡니다.
 */

/** 민감도별 임계값 (개인 기준 편차의 상대 크기) */
interface Thresholds {
  warningEnter: number
  warningExit: number
  badEnter: number
  badExit: number
}

const SENSITIVITY_THRESHOLDS: Record<Sensitivity, Thresholds> = {
  gentle: { warningEnter: 0.55, warningExit: 0.4, badEnter: 0.95, badExit: 0.75 },
  default: { warningEnter: 0.4, warningExit: 0.28, badEnter: 0.7, badExit: 0.52 },
  sensitive: { warningEnter: 0.28, warningExit: 0.2, badEnter: 0.5, badExit: 0.36 },
}

const KEYS: Array<keyof FeatureVector> = [
  'faceWidth',
  'headOffsetX',
  'headOffsetY',
  'headTilt',
  'shoulderTilt',
]

/** 축별 최소 허용 오차 (기준의 분산이 0에 가까울 때 과민 반응 방지) */
const FLOOR: Record<keyof FeatureVector, number> = {
  faceWidth: 0.05,
  headOffsetX: 0.04,
  headOffsetY: 0.05,
  headTilt: 0.06,
  shoulderTilt: 0.04,
}

export interface DeviationResult {
  /** 각 축의 정규화 이탈 (variance 기준) */
  perAxis: Record<keyof FeatureVector, number>
  /** 최대 이탈 = 종합 점수 */
  score: number
  category: DeviationCategory
}

export function computeDeviation(
  features: FeatureVector,
  profile: CalibrationProfile,
): DeviationResult {
  const perAxis = {} as Record<keyof FeatureVector, number>
  for (const key of KEYS) {
    const tolerance = Math.max(FLOOR[key], profile.variance[key] * 2)
    perAxis[key] = Math.abs(features[key] - profile.baseline[key]) / tolerance
  }

  // 최대 이탈 축을 종합 점수로 사용 (평균 금지)
  let score = 0
  let topKey: keyof FeatureVector = 'faceWidth'
  for (const key of KEYS) {
    if (perAxis[key] > score) {
      score = perAxis[key]
      topKey = key
    }
  }

  const category: DeviationCategory =
    topKey === 'faceWidth' || topKey === 'headOffsetY'
      ? 'forward'
      : topKey === 'headTilt'
        ? 'tilt'
        : topKey === 'shoulderTilt'
          ? 'shoulder'
          : 'mixed'

  return { perAxis, score, category }
}

/**
 * EMA 로 스무딩한 점수를 히스테리시스로 분류합니다.
 * 한 프레임으로 상태를 바꾸지 않도록 이전 상태를 참고합니다.
 */
export function classify(
  smoothedScore: number,
  previous: PostureState,
  sensitivity: Sensitivity,
): PostureState {
  const t = SENSITIVITY_THRESHOLDS[sensitivity]

  if (previous === 'bad') {
    if (smoothedScore < t.warningExit) return 'good'
    if (smoothedScore < t.badExit) return 'warning'
    return 'bad'
  }
  if (previous === 'warning') {
    if (smoothedScore >= t.badEnter) return 'bad'
    if (smoothedScore < t.warningExit) return 'good'
    return 'warning'
  }
  // previous good / away / unstable
  if (smoothedScore >= t.badEnter) return 'bad'
  if (smoothedScore >= t.warningEnter) return 'warning'
  return 'good'
}

/** 지수 이동 평균 + 이상값 제한 */
export function emaUpdate(prev: number, next: number, alpha = 0.35): number {
  const clamped = Math.min(next, prev + 0.6) // 급격한 상승 제한
  return prev + alpha * (clamped - prev)
}
