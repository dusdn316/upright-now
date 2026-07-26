import type { LandmarkAnalysis, PointInfo } from '@/features/posture-engine/features'

/**
 * 캘리브레이션 전용 프레이밍 품질 게이트.
 *
 * 이 검사는 의료적 '정상 자세' 기준이 아니라, "안정적인 개인 기준을 등록할 수
 * 있는 프레이밍 조건"입니다. 심하게 옆으로 기울거나 누운 상태의 표본이
 * 기준에 섞이는 것만 막고, 가벼운 자연스러운 비대칭(한쪽 어깨가 조금 높은
 * 자세, 미세 움직임)은 그대로 허용합니다.
 *
 * 세션 자세 판정 임계값과는 완전히 분리되어 있으며, 원본 좌표·영상은
 * 저장하지 않고 프레임 안에서 각도만 계산해 즉시 버립니다.
 */
export const MAX_EYE_ROLL_DEG = 18
export const MAX_SHOULDER_ROLL_DEG = 18
/** 눈 중앙이 어깨 중앙보다 어깨너비의 이 비율만큼은 위에 있어야 함 */
export const MIN_EYE_ABOVE_RATIO = 0.2
/** 얼굴·어깨 중심이 있어야 하는 안전 영역 (정규화 좌표) */
export const SAFE_AREA = { xMin: 0.1, xMax: 0.9, yMin: 0.03, yMax: 0.95 }

export type FramingReason =
  | 'head-roll'
  | 'shoulder-roll'
  | 'not-upright'
  | 'out-of-safe-area'

export type FramingVerdict =
  | { ok: true }
  | { ok: false; reason: FramingReason }

/** 두 점을 잇는 선의 수평 대비 기울기 (도, -90~90) */
export function lineRollDeg(a: PointInfo, b: PointInfo): number {
  let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  deg = deg % 180
  if (deg > 90) deg -= 180
  if (deg < -90) deg += 180
  return deg
}

function inSafeArea(x: number, y: number): boolean {
  return (
    x >= SAFE_AREA.xMin &&
    x <= SAFE_AREA.xMax &&
    y >= SAFE_AREA.yMin &&
    y <= SAFE_AREA.yMax
  )
}

export function checkCalibrationFraming(a: LandmarkAnalysis): FramingVerdict {
  const le = a.points.leftEyeOuter
  const re = a.points.rightEyeOuter
  const ls = a.points.leftShoulder
  const rs = a.points.rightShoulder

  // 눈선 roll — 머리를 크게 옆으로 기울인 상태
  if (le.present && re.present) {
    if (Math.abs(lineRollDeg(le, re)) > MAX_EYE_ROLL_DEG) {
      return { ok: false, reason: 'head-roll' }
    }
  }

  // 어깨선 roll — 상체가 크게 기운 상태
  if (Math.abs(lineRollDeg(ls, rs)) > MAX_SHOULDER_ROLL_DEG) {
    return { ok: false, reason: 'shoulder-roll' }
  }

  // 수직 관계 — 얼굴이 어깨 옆에 누운 형태 차단 (y 는 아래로 증가)
  const eyeMidX = (le.x + re.x) / 2
  const eyeMidY = (le.y + re.y) / 2
  const shoulderMidX = (ls.x + rs.x) / 2
  const shoulderMidY = (ls.y + rs.y) / 2
  if (eyeMidY > shoulderMidY - a.shoulderWidth * MIN_EYE_ABOVE_RATIO) {
    return { ok: false, reason: 'not-upright' }
  }

  // 얼굴·어깨 중심이 가이드 안전 영역 안에 있는지
  if (!inSafeArea(eyeMidX, eyeMidY) || !inSafeArea(shoulderMidX, shoulderMidY)) {
    return { ok: false, reason: 'out-of-safe-area' }
  }

  return { ok: true }
}
