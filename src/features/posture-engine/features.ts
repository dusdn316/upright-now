/**
 * Pose 랜드마크 분석 — 필수/선택 랜드마크 분리 (긴급 안정화)
 *
 * Core required: nose 또는 양쪽 outer eye + 양쪽 어깨
 * Optional: ears · hips · z — 없다는 이유만으로 unavailable 이 되지 않습니다.
 *
 * 모든 2D 값은 shoulderWidth 로 정규화합니다. 고정 픽셀값을 쓰지 않습니다.
 * visibility 는 "보이는 정도"로만 쓰고 자세 정확도 확률로 해석하지 않습니다.
 */

/** MediaPipe Pose 랜드마크 인덱스 */
const IDX = {
  nose: 0,
  leftEyeOuter: 3,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const

export type PointName = keyof typeof IDX

export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface PointInfo {
  x: number
  y: number
  z: number
  visibility: number
  /** 이 랜드마크를 계산에 써도 되는가 (visibility 기준) */
  present: boolean
}

export type FeatureKey =
  | 'faceScaleRatio'
  | 'headHeightRatio'
  | 'lateralOffsetRatio'
  | 'shoulderTiltRatio'
  | 'forwardDepthRatio'
  | 'torsoLean'

export const PRIMARY_FEATURES: FeatureKey[] = [
  'faceScaleRatio',
  'headHeightRatio',
  'lateralOffsetRatio',
  'shoulderTiltRatio',
  'torsoLean',
]

/** z 기반 특징 — 보조 신호로만 사용 (단독으로 warning/bad 를 만들지 않음) */
export const AUXILIARY_FEATURES: FeatureKey[] = ['forwardDepthRatio']

export interface LandmarkAnalysis {
  points: Record<PointName, PointInfo>
  shoulderWidth: number
  /** nose 또는 양쪽 outer eye */
  faceCoreOk: boolean
  bothShouldersOk: boolean
  earsOk: boolean
  hipsOk: boolean
  /** 코가 눈 중앙에서 얼마나 벗어났는지 (0=정면, 1≈눈 위치) */
  yawRatio: number
  severeRotation: boolean
  /** 중간 정도 고개 돌림 — 코 기반 특징(좌우·z)을 측정 제한으로 제외 */
  moderateRotation: boolean
  inFrame: boolean
  /** 계산 가능한 특징만 담김 */
  features: Partial<Record<FeatureKey, number>>
  /** 이번 프레임에서 제외된 특징과 이유 */
  excluded: Partial<Record<FeatureKey, string>>
  meanCoreVisibility: number
}

const PRESENCE_MIN = 0.5
export const MIN_SHOULDER_WIDTH = 0.09
/**
 * 고개 돌림 게이트 — 실카메라에서 두 번째 모니터를 보는 정도(~20°)의 곁눈질이
 * severe 로 잡혀 unstable 로 튀던 문제(합성 데이터 기준 0.7)를 완화합니다.
 * moderate(0.5~0.9): 코 기반 특징만 제외하고 판정은 계속합니다.
 * severe(>0.9): 측정 제한(unstable) — 자세 이탈(bad)로 판정하지 않습니다.
 */
const YAW_SEVERE = 0.9
const YAW_MODERATE = 0.5
const FRAME_MARGIN = 0.06

function toPoint(lm: Landmark | undefined): PointInfo {
  if (!lm) return { x: 0, y: 0, z: 0, visibility: 0, present: false }
  const visibility = lm.visibility ?? 0
  return { ...lm, visibility, present: visibility >= PRESENCE_MIN }
}

function inFrame(p: PointInfo): boolean {
  return (
    p.x >= -FRAME_MARGIN &&
    p.x <= 1 + FRAME_MARGIN &&
    p.y >= -FRAME_MARGIN &&
    p.y <= 1 + FRAME_MARGIN
  )
}

export function analyzeLandmarks(
  landmarks: Landmark[] | undefined,
): LandmarkAnalysis | null {
  if (!landmarks || landmarks.length < 25) return null

  const points = {} as Record<PointName, PointInfo>
  for (const name of Object.keys(IDX) as PointName[]) {
    points[name] = toPoint(landmarks[IDX[name]])
  }

  const {
    nose,
    leftEyeOuter,
    rightEyeOuter,
    leftEar,
    rightEar,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
  } = points

  const eyesOk = leftEyeOuter.present && rightEyeOuter.present
  const faceCoreOk = nose.present || eyesOk
  const bothShouldersOk = leftShoulder.present && rightShoulder.present
  const earsOk = leftEar.present && rightEar.present
  const hipsOk = leftHip.present && rightHip.present

  const shoulderWidth = Math.hypot(
    leftShoulder.x - rightShoulder.x,
    leftShoulder.y - rightShoulder.y,
  )
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2
  const shoulderMidZ = (leftShoulder.z + rightShoulder.z) / 2

  // 얼굴 회전 프록시 — 정면이면 코가 두 눈 중앙 근처에 있습니다.
  const eyeDist = eyesOk
    ? Math.hypot(leftEyeOuter.x - rightEyeOuter.x, leftEyeOuter.y - rightEyeOuter.y)
    : 0
  const eyeMidX = (leftEyeOuter.x + rightEyeOuter.x) / 2
  const eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2
  const yawRatio =
    eyesOk && nose.present && eyeDist > 0
      ? Math.abs(nose.x - eyeMidX) / (eyeDist / 2)
      : 0
  const severeRotation = yawRatio > YAW_SEVERE
  const moderateRotation = !severeRotation && yawRatio > YAW_MODERATE

  const corePoints = [leftShoulder, rightShoulder, ...(eyesOk ? [leftEyeOuter, rightEyeOuter] : [nose])]
  const frameOk = corePoints.every(inFrame)

  const meanCoreVisibility =
    corePoints.reduce((sum, p) => sum + p.visibility, 0) / corePoints.length

  const features: Partial<Record<FeatureKey, number>> = {}
  const excluded: Partial<Record<FeatureKey, string>> = {}
  const sw = shoulderWidth || 1

  if (eyesOk && bothShouldersOk) {
    features.faceScaleRatio = eyeDist / sw
    features.headHeightRatio = (shoulderMidY - eyeMidY) / sw
  } else {
    excluded.faceScaleRatio = eyesOk ? '어깨 미감지' : '눈 미감지'
    excluded.headHeightRatio = eyesOk ? '어깨 미감지' : '눈 미감지'
  }

  if (nose.present && bothShouldersOk && !moderateRotation) {
    features.lateralOffsetRatio = Math.abs(nose.x - shoulderMidX) / sw
    features.forwardDepthRatio = shoulderMidZ - nose.z
  } else if (moderateRotation) {
    // 고개를 돌리면 코가 어깨 중앙에서 벗어나는 것이 자연스럽습니다.
    // 자세 이탈로 과금하지 않고 측정 제한으로 제외합니다.
    excluded.lateralOffsetRatio = '고개 돌림(측정 제한)'
    excluded.forwardDepthRatio = '고개 돌림(측정 제한)'
  } else {
    excluded.lateralOffsetRatio = nose.present ? '어깨 미감지' : '코 미감지'
    excluded.forwardDepthRatio = nose.present ? '어깨 미감지' : '코 미감지'
  }

  if (bothShouldersOk) {
    features.shoulderTiltRatio = Math.abs(leftShoulder.y - rightShoulder.y) / sw
  } else {
    excluded.shoulderTiltRatio = '어깨 미감지'
  }

  if (hipsOk && bothShouldersOk) {
    const hipMidX = (leftHip.x + rightHip.x) / 2
    features.torsoLean = Math.abs(shoulderMidX - hipMidX) / sw
  } else {
    excluded.torsoLean = hipsOk ? '어깨 미감지' : '엉덩이 화면 밖'
  }

  return {
    points,
    shoulderWidth,
    faceCoreOk,
    bothShouldersOk,
    earsOk,
    hipsOk,
    yawRatio,
    severeRotation,
    moderateRotation,
    inFrame: frameOk,
    features,
    excluded,
    meanCoreVisibility,
  }
}

/* ------------------------------ 통계 유틸 ------------------------------ */

export function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/** MAD (median absolute deviation) — 평균·표준편차보다 이상값에 강합니다. */
export function mad(nums: number[], center = median(nums)): number {
  return median(nums.map((n) => Math.abs(n - center)))
}
