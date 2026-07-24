import type { FeatureVector } from '@/features/calibration/calibrationStore'

/**
 * Pose 랜드마크 → 정규화 특징값 — docs/06 §4, §5
 *
 * 어깨 너비로 정규화해 카메라 거리·해상도 영향을 줄입니다.
 * 깊이값(z)은 실제 cm 로 해석하지 않습니다. 상대 변화만 사용합니다.
 * CVA·C7·임상 각도는 계산하지 않습니다.
 */

/** MediaPipe Pose 랜드마크 인덱스 (필요한 것만) */
const NOSE = 0
const LEFT_EAR = 7
const RIGHT_EAR = 8
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12

export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface FeatureResult {
  features: FeatureVector
  /** 주요 랜드마크 평균 가시성 */
  visibility: number
  /** 얼굴·양쪽 어깨가 충분히 보이는지 */
  usable: boolean
}

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function vis(...points: Array<Landmark | undefined>): number {
  const values = points.map((p) => p?.visibility ?? 0)
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

const MIN_VISIBILITY = 0.5
const MIN_SHOULDER_WIDTH = 0.08 // 프레임 대비 어깨 너비 최소값

export function extractFeatures(landmarks: Landmark[]): FeatureResult | null {
  if (landmarks.length < 13) return null

  const nose = landmarks[NOSE]
  const leftEar = landmarks[LEFT_EAR]
  const rightEar = landmarks[RIGHT_EAR]
  const leftShoulder = landmarks[LEFT_SHOULDER]
  const rightShoulder = landmarks[RIGHT_SHOULDER]

  const visibility = vis(nose, leftEar, rightEar, leftShoulder, rightShoulder)

  const shoulderWidth = dist(leftShoulder, rightShoulder)
  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: 0,
  }
  const headCenter = {
    x: (leftEar.x + rightEar.x) / 2,
    y: (leftEar.y + rightEar.y) / 2,
    z: 0,
  }

  const usable =
    visibility >= MIN_VISIBILITY && shoulderWidth >= MIN_SHOULDER_WIDTH

  const faceWidth = dist(leftEar, rightEar) / shoulderWidth
  const headOffsetX = (headCenter.x - shoulderCenter.x) / shoulderWidth
  const headOffsetY = (shoulderCenter.y - headCenter.y) / shoulderWidth
  const headTilt = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x)
  const shoulderTilt =
    (rightShoulder.y - leftShoulder.y) / (shoulderWidth || 1)

  return {
    features: { faceWidth, headOffsetX, headOffsetY, headTilt, shoulderTilt },
    visibility,
    usable,
  }
}

/** 특징 벡터들의 축별 중앙값 — 캘리브레이션 집계용 (docs/06 §6) */
export function medianFeatures(samples: FeatureVector[]): FeatureVector {
  const keys: Array<keyof FeatureVector> = [
    'faceWidth',
    'headOffsetX',
    'headOffsetY',
    'headTilt',
    'shoulderTilt',
  ]
  const median = (nums: number[]): number => {
    const sorted = [...nums].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }
  const out = {} as FeatureVector
  for (const key of keys) {
    out[key] = median(samples.map((s) => s[key]))
  }
  return out
}

/** 축별 표준편차 — 허용 범위(variance) 산출용 */
export function stdevFeatures(
  samples: FeatureVector[],
  baseline: FeatureVector,
): FeatureVector {
  const keys: Array<keyof FeatureVector> = [
    'faceWidth',
    'headOffsetX',
    'headOffsetY',
    'headTilt',
    'shoulderTilt',
  ]
  const out = {} as FeatureVector
  for (const key of keys) {
    const variance =
      samples.reduce((sum, s) => sum + (s[key] - baseline[key]) ** 2, 0) /
      Math.max(1, samples.length)
    out[key] = Math.sqrt(variance)
  }
  return out
}
