import { mad, median, MIN_SHOULDER_WIDTH, PRIMARY_FEATURES, AUXILIARY_FEATURES } from '@/features/posture-engine/features'
import type { FeatureKey, LandmarkAnalysis } from '@/features/posture-engine/features'
import type { CalibrationProfile, FeatureStat } from './calibrationStore'

/**
 * 캘리브레이션 표본 수집 v2 — 순수 로직. 시간은 호출자가 넘깁니다.
 *
 * - 최초 1초는 모델 워밍업으로 표본에서 제외합니다.
 * - 최소 40개 이상의 유효 프레임을 요구합니다.
 * - 큰 움직임 · 얼굴 회전 · 한쪽 어깨 누락 프레임은 표본에서 제외합니다
 *   (전체 초기화가 아니라 그 프레임만 버립니다).
 * - 특징마다 median + MAD + validSampleCount 를 저장합니다.
 */
export const WARMUP_MS = 1000
export const TARGET_MS = 5000
export const TIMEOUT_MS = 12000
export const MIN_VALID_SAMPLES = 40
/** 특징이 기준에 포함되기 위한 최소 표본 수 */
const MIN_FEATURE_SAMPLES = 30
const MOVEMENT_LIMIT = 0.2

export type CalibrationQuality =
  | 'idle'
  | 'warming'
  | 'ok'
  | 'no-person'
  | 'low-visibility'
  | 'moving'
  | 'rotated'
  | 'timeout'

interface Sample {
  features: Partial<Record<FeatureKey, number>>
  shoulderWidth: number
  visibility: number
}

export interface CollectState {
  startedAt: number | null
  samples: Sample[]
}

export interface CollectResult {
  state: CollectState
  quality: CalibrationQuality
  /** 0~1 */
  progress: number
  validCount: number
  /** 완료 시 저장할 프로필. 아직이면 null. */
  profile: CalibrationProfile | null
  /** TIMEOUT_MS 안에 표본을 못 모아 다시 시작해야 함 */
  failed: boolean
}

export function createCollectState(): CollectState {
  return { startedAt: null, samples: [] }
}

function movedTooMuch(next: Sample, prev: Sample | undefined): boolean {
  if (!prev) return false
  const keys: FeatureKey[] = ['faceScaleRatio', 'headHeightRatio', 'lateralOffsetRatio']
  return keys.some((key) => {
    const a = next.features[key]
    const b = prev.features[key]
    return a !== undefined && b !== undefined && Math.abs(a - b) > MOVEMENT_LIMIT
  })
}

export function collectStep(
  state: CollectState,
  input: {
    analysis: LandmarkAnalysis | null
    now: number
    deviceIdHash?: string | null
    profileName?: string
  },
): CollectResult {
  const { analysis, now, deviceIdHash = null, profileName = '기본 자세' } = input

  const startedAt = state.startedAt ?? now
  const elapsed = now - startedAt
  const progress = Math.min(1, elapsed / TARGET_MS)

  const base: Omit<CollectResult, 'quality'> = {
    state: { startedAt, samples: state.samples },
    progress,
    validCount: state.samples.length,
    profile: null,
    failed: false,
  }

  // 시간 초과 → 처음부터 다시
  if (elapsed > TIMEOUT_MS && state.samples.length < MIN_VALID_SAMPLES) {
    return {
      ...base,
      state: createCollectState(),
      quality: 'timeout',
      progress: 0,
      validCount: 0,
      failed: true,
    }
  }

  // 프레임 판별 — 나쁜 프레임은 "그 프레임만" 버립니다.
  if (!analysis) {
    return { ...base, quality: 'no-person' }
  }
  if (!analysis.faceCoreOk || !analysis.bothShouldersOk) {
    return { ...base, quality: 'low-visibility' }
  }
  if (analysis.shoulderWidth < MIN_SHOULDER_WIDTH || !analysis.inFrame) {
    return { ...base, quality: 'low-visibility' }
  }
  if (analysis.severeRotation) {
    return { ...base, quality: 'rotated' }
  }

  // 워밍업 구간은 표본에서 제외
  if (elapsed < WARMUP_MS) {
    return { ...base, quality: 'warming' }
  }

  const sample: Sample = {
    features: analysis.features,
    shoulderWidth: analysis.shoulderWidth,
    visibility: analysis.meanCoreVisibility,
  }

  if (movedTooMuch(sample, state.samples.at(-1))) {
    return { ...base, quality: 'moving' }
  }

  const samples = [...state.samples, sample]

  // 완료 조건: 목표 시간 경과 + 유효 표본 40개 이상
  if (elapsed >= TARGET_MS && samples.length >= MIN_VALID_SAMPLES) {
    return {
      state: createCollectState(),
      quality: 'ok',
      progress: 1,
      validCount: samples.length,
      profile: buildProfile(samples, now, deviceIdHash, profileName),
      failed: false,
    }
  }

  return {
    state: { startedAt, samples },
    quality: 'ok',
    progress,
    validCount: samples.length,
    profile: null,
    failed: false,
  }
}

function buildProfile(
  samples: Sample[],
  now: number,
  deviceIdHash: string | null,
  name: string,
): CalibrationProfile {
  const features: Partial<Record<FeatureKey, FeatureStat>> = {}

  for (const key of [...PRIMARY_FEATURES, ...AUXILIARY_FEATURES]) {
    const values = samples
      .map((s) => s.features[key])
      .filter((v): v is number => v !== undefined)
    // 표본이 부족한 특징(예: 화면 밖 엉덩이의 torsoLean)은 기준에서 제외합니다.
    if (values.length < MIN_FEATURE_SAMPLES) continue
    const center = median(values)
    features[key] = {
      median: center,
      mad: mad(values, center),
      validSampleCount: values.length,
    }
  }

  return {
    version: 2,
    id: `cal-${Math.round(now)}`,
    name,
    createdAt: Date.now(),
    features,
    shoulderWidthMedian: median(samples.map((s) => s.shoulderWidth)),
    deviceIdHash,
    quality: {
      validSampleCount: samples.length,
      meanVisibility:
        samples.reduce((sum, s) => sum + s.visibility, 0) / samples.length,
    },
  }
}
