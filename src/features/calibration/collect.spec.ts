import { describe, expect, it } from 'vitest'
import {
  collectStep,
  createCollectState,
  MIN_VALID_SAMPLES,
  TARGET_MS,
  WARMUP_MS,
  type CollectState,
} from './collect'
import { analyzeLandmarks } from '@/features/posture-engine/features'
import { makeLandmarks } from '@/features/posture-engine/testFixtures'
import { isDistanceMismatch } from '@/features/posture-engine/classify'

const goodFrame = () => analyzeLandmarks(makeLandmarks())

/** 12fps 로 duration 동안 프레임을 흘려보냅니다. */
function feed(
  state: CollectState,
  fromMs: number,
  toMs: number,
): { state: CollectState; profile: ReturnType<typeof collectStep>['profile'] } {
  let s = state
  let profile = null
  for (let now = fromMs; now <= toMs; now += 83) {
    const step = collectStep(s, { analysis: goodFrame(), now, deviceIdHash: 'dev1' })
    s = step.state
    if (step.profile) profile = step.profile
  }
  return { state: s, profile }
}

describe('캘리브레이션 v2 (긴급 안정화 D)', () => {
  it('워밍업 1초는 표본에서 제외된다', () => {
    const { state } = feed(createCollectState(), 0, WARMUP_MS - 100)
    expect(state.samples.length).toBe(0)
  })

  it('5초 + 유효 40프레임을 모으면 median·MAD·표본 수를 담은 기준을 만든다', () => {
    const { profile } = feed(createCollectState(), 0, TARGET_MS + 200)

    expect(profile).not.toBeNull()
    expect(profile!.version).toBe(2)
    expect(profile!.quality.validSampleCount).toBeGreaterThanOrEqual(
      MIN_VALID_SAMPLES,
    )
    expect(profile!.deviceIdHash).toBe('dev1')
    expect(profile!.shoulderWidthMedian).toBeCloseTo(0.24, 2)

    const face = profile!.features.faceScaleRatio
    expect(face).toBeDefined()
    expect(face!.median).toBeCloseTo(0.09 / 0.24, 2)
    expect(face!.mad).toBeLessThan(0.01)
    expect(face!.validSampleCount).toBeGreaterThanOrEqual(30)
  })

  it('사람 미감지 프레임은 그 프레임만 버린다 (전체 초기화 아님)', () => {
    let { state } = feed(createCollectState(), 0, 2000)
    const before = state.samples.length
    const step = collectStep(state, { analysis: null, now: 2100 })
    expect(step.quality).toBe('no-person')
    expect(step.state.samples.length).toBe(before)
  })

  it('한쪽 어깨가 잘린 프레임은 low-visibility 로 제외한다', () => {
    const cropped = analyzeLandmarks(
      makeLandmarks({ visibility: { leftShoulder: 0.1 } }),
    )
    const step = collectStep(createCollectState(), {
      analysis: cropped,
      now: 1500,
    })
    expect(step.quality).toBe('low-visibility')
    expect(step.state.samples.length).toBe(0)
  })

  it('얼굴이 크게 돌아간 프레임은 rotated 로 제외한다', () => {
    let { state } = feed(createCollectState(), 0, 1500)
    const rotated = analyzeLandmarks(
      makeLandmarks({ move: { nose: { dx: 0.04 } } }),
    )
    const step = collectStep(state, { analysis: rotated, now: 1600 })
    expect(step.quality).toBe('rotated')
  })

  it('큰 움직임 프레임은 moving 으로 제외한다', () => {
    let { state } = feed(createCollectState(), 0, 1500)
    const moved = analyzeLandmarks(
      makeLandmarks({
        move: {
          nose: { dx: 0.08 },
          leftEyeOuter: { dx: 0.08 },
          rightEyeOuter: { dx: 0.08 },
        },
      }),
    )
    const step = collectStep(state, { analysis: moved, now: 1600 })
    expect(step.quality).toBe('moving')
  })

  it('유효 표본이 부족한 채 시간이 초과되면 저장하지 않고 실패를 알린다', () => {
    // 유효 프레임을 거의 안 주고 시간만 초과
    let state = createCollectState()
    let failed = false
    for (let now = 0; now <= 13000; now += 500) {
      const step = collectStep(state, { analysis: null, now })
      state = step.state
      if (step.failed) failed = true
      expect(step.profile).toBeNull()
    }
    expect(failed).toBe(true)
  })
})

describe('카메라 거리 확인 (긴급 안정화 D)', () => {
  it('어깨 너비가 기준보다 20% 이상 다르면 안내 대상이다', () => {
    expect(isDistanceMismatch(0.24, 0.24)).toBe(false)
    expect(isDistanceMismatch(0.24 * 1.15, 0.24)).toBe(false)
    expect(isDistanceMismatch(0.24 * 1.25, 0.24)).toBe(true)
    expect(isDistanceMismatch(0.24 * 0.75, 0.24)).toBe(true)
  })
})
