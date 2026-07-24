import { describe, expect, it } from 'vitest'
import { collectStep, createCollectState } from './collect'
import type { FeatureResult } from '@/features/posture-engine/features'

const goodFrame: FeatureResult = {
  features: {
    faceWidth: 0.6,
    headOffsetX: 0.0,
    headOffsetY: 0.5,
    headTilt: 0.0,
    shoulderTilt: 0.0,
  },
  visibility: 0.9,
  usable: true,
}

describe('collectStep — 5초 캘리브레이션 (docs/06 §6)', () => {
  it('안정 상태 5초 → 개인 기준 프로필 생성', () => {
    let state = createCollectState()
    let profile = null

    for (const now of [0, 1000, 2000, 3000, 4000, 5000]) {
      const step = collectStep(state, { result: goodFrame, now })
      state = step.state
      if (step.profile) profile = step.profile
    }

    expect(profile).not.toBeNull()
    expect(profile?.baseline.faceWidth).toBeCloseTo(0.6)
    expect(profile?.quality.sampleCount).toBeGreaterThanOrEqual(3)
  })

  it('사람 미감지에서는 저장하지 않고 진행을 초기화한다', () => {
    const step = collectStep(createCollectState(), { result: null, now: 1000 })
    expect(step.quality).toBe('no-person')
    expect(step.profile).toBeNull()
    expect(step.progress).toBe(0)
  })

  it('얼굴·어깨 가시성 부족이면 저장하지 않는다', () => {
    const cropped: FeatureResult = { ...goodFrame, usable: false }
    const step = collectStep(createCollectState(), { result: cropped, now: 1000 })
    expect(step.quality).toBe('low-visibility')
    expect(step.profile).toBeNull()
  })

  it('큰 움직임이 감지되면 진행을 초기화한다', () => {
    let state = createCollectState()
    state = collectStep(state, { result: goodFrame, now: 0 }).state

    const moved: FeatureResult = {
      ...goodFrame,
      features: { ...goodFrame.features, headOffsetX: 0.9 },
    }
    const step = collectStep(state, { result: moved, now: 1000 })
    expect(step.quality).toBe('moving')
    expect(step.profile).toBeNull()
    expect(step.state.samples).toHaveLength(0)
  })
})
