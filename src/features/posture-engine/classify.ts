import {
  AUXILIARY_FEATURES,
  PRIMARY_FEATURES,
  type FeatureKey,
} from './features'
import type { CalibrationProfile } from '@/features/calibration/calibrationStore'
import { BAD_HOLD_MS, type Sensitivity } from '@/constants/posture'

/**
 * 개인 기준 대비 방향성 편차 → 투표 → 지속 시간 기반 상태 확정 (긴급 안정화)
 *
 * - 단순 평균도, 신뢰도 없는 raw max 도 쓰지 않습니다.
 * - 각 특징의 "나빠지는 방향" 편차만 baseline tolerance 단위로 계산합니다.
 * - warning: 신뢰 특징 1개 이상 > 1.0 이 1.5초 지속
 * - bad: 신뢰 특징 2개 이상 > 1.0 (그중 1개는 주 특징) 또는
 *        주 특징 1개 > 1.8 + 품질 good, 5초 지속
 * - good: 사용 중인 모든 특징 < 0.65 가 2초 지속
 * - z(forwardDepthRatio)는 보조: 단독으로 warning/bad 를 만들지 않습니다.
 */

/** 나빠지는 방향: +1 = 증가가 이탈, -1 = 감소가 이탈 */
const DIRECTION: Record<FeatureKey, 1 | -1> = {
  faceScaleRatio: 1, // 얼굴이 커짐 = 카메라 쪽으로 접근
  headHeightRatio: -1, // 눈-어깨 거리가 줄어듦 = 고개 숙임·움츠림
  lateralOffsetRatio: 1, // 코가 어깨 중앙에서 벗어남 = 좌우 기울기
  shoulderTiltRatio: 1, // 어깨 높이 차 증가
  forwardDepthRatio: 1, // 코가 어깨보다 카메라 쪽 (보조)
  torsoLean: 1, // 상체 좌우 쏠림 (엉덩이 보일 때만)
}

/**
 * 축별 최소 허용 오차 — 캘리브레이션 중 가만히 앉아 MAD 가 0에 가까워도
 * 정상적인 미세 움직임이 이탈로 잡히지 않게 하는 바닥값입니다.
 */
const FLOOR: Record<FeatureKey, number> = {
  faceScaleRatio: 0.05,
  headHeightRatio: 0.08,
  lateralOffsetRatio: 0.07,
  shoulderTiltRatio: 0.06,
  forwardDepthRatio: 0.35,
  torsoLean: 0.08,
}

/** MAD → tolerance 배수 */
const MAD_K = 8

const SENSITIVITY_MULT: Record<Sensitivity, number> = {
  gentle: 1.4,
  default: 1.0,
  sensitive: 0.75,
}

export const WARNING_ENTER = 1.0
export const BAD_STRONG = 1.8
export const GOOD_EXIT = 0.65

export interface DeviationDetail {
  key: FeatureKey
  value: number
  baseline: number
  tolerance: number
  /** 방향성 편차 (나빠지는 방향만, ≥0) */
  deviation: number
  /** 주 특징인지 (z 는 보조) */
  primary: boolean
  exceeded: boolean
}

export interface FrameVotes {
  details: DeviationDetail[]
  /** 1.0 을 넘은 주 특징 수 */
  primaryExceedCount: number
  /** 1.0 을 넘은 보조(z) 특징 수 */
  auxExceedCount: number
  /** 주 특징 최대 편차 */
  maxPrimary: number
  usedFeatureCount: number
  voteWarning: boolean
  voteBad: boolean
  voteGood: boolean
}

export function computeVotes(
  features: Partial<Record<FeatureKey, number>>,
  profile: CalibrationProfile,
  sensitivity: Sensitivity,
  qualityGood: boolean,
): FrameVotes {
  const mult = SENSITIVITY_MULT[sensitivity]
  const details: DeviationDetail[] = []

  for (const key of [...PRIMARY_FEATURES, ...AUXILIARY_FEATURES]) {
    const value = features[key]
    const stat = profile.features[key]
    // 이번 프레임에 없거나 기준에 없는 특징은 판정에서 제외합니다.
    if (value === undefined || !stat) continue

    const tolerance = mult * Math.max(FLOOR[key], stat.mad * MAD_K)
    const delta = (value - stat.median) * DIRECTION[key]
    const deviation = Math.max(0, delta) / tolerance

    details.push({
      key,
      value,
      baseline: stat.median,
      tolerance,
      deviation,
      primary: PRIMARY_FEATURES.includes(key),
      exceeded: deviation > WARNING_ENTER,
    })
  }

  const primaries = details.filter((d) => d.primary)
  const primaryExceedCount = primaries.filter((d) => d.exceeded).length
  const auxExceedCount = details.filter((d) => !d.primary && d.exceeded).length
  const maxPrimary = primaries.reduce((max, d) => Math.max(max, d.deviation), 0)

  // z 단독 이탈은 warning 도 만들지 않습니다.
  const voteWarning = primaryExceedCount >= 1
  const voteBad =
    (primaryExceedCount >= 1 && primaryExceedCount + auxExceedCount >= 2) ||
    (maxPrimary > BAD_STRONG && qualityGood)
  const voteGood = details.every((d) => d.deviation < GOOD_EXIT)

  return {
    details,
    primaryExceedCount,
    auxExceedCount,
    maxPrimary,
    usedFeatureCount: details.length,
    voteWarning,
    voteBad,
    voteGood,
  }
}

/** 어깨 너비가 기준보다 20% 이상 달라졌는지 — 카메라 거리 확인 안내용 */
export function isDistanceMismatch(
  shoulderWidth: number,
  baselineShoulderWidth: number,
  tolerance = 0.2,
): boolean {
  if (baselineShoulderWidth <= 0) return false
  return (
    Math.abs(shoulderWidth - baselineShoulderWidth) / baselineShoulderWidth >
    tolerance
  )
}

/* ------------------- 지속 시간 기반 상태 확정 (순수) ------------------- */

export type ArbiterPosture = 'good' | 'warning' | 'bad'

export interface ArbiterState {
  current: ArbiterPosture
  candidate: ArbiterPosture | null
  candidateSince: number
}

/**
 * 상태 확정 지속 시간 — bad 5초의 유일한 소유자입니다.
 * postureMachine 은 여기서 확정된 bad 를 받아 즉시 회복 기회를 엽니다.
 */
const HOLD_MS: Record<ArbiterPosture, number> = {
  warning: 1500,
  bad: BAD_HOLD_MS,
  good: 2000,
}

export function createArbiter(): ArbiterState {
  return { current: 'good', candidate: null, candidateSince: 0 }
}

/**
 * 프레임 투표를 지속 시간으로 확정합니다.
 * 투표가 중간 지대(0.65~1.0)면 후보를 지우고 현재 상태를 유지합니다(히스테리시스).
 */
export function arbiterStep(
  state: ArbiterState,
  votes: Pick<FrameVotes, 'voteWarning' | 'voteBad' | 'voteGood'>,
  now: number,
): ArbiterState {
  const target: ArbiterPosture | null = votes.voteBad
    ? 'bad'
    : votes.voteWarning
      ? 'warning'
      : votes.voteGood
        ? 'good'
        : null

  if (target === null || target === state.current) {
    return { ...state, candidate: null, candidateSince: now }
  }

  if (state.candidate !== target) {
    return { ...state, candidate: target, candidateSince: now }
  }

  if (now - state.candidateSince >= HOLD_MS[target]) {
    return { current: target, candidate: null, candidateSince: now }
  }

  return state
}
