import { describe, expect, it } from 'vitest'
import { analyzeLandmarks } from '@/features/posture-engine/features'
import { makeLandmarks } from '@/features/posture-engine/testFixtures'
import { checkCalibrationFraming, lineRollDeg } from './framingGate'
import { collectStep, createCollectState, FRAMING_MS, TARGET_MS } from './collect'
import type { CollectState } from './collect'

const analyze = (overrides?: Parameters<typeof makeLandmarks>[0]) =>
  analyzeLandmarks(makeLandmarks(overrides))!

/** 눈선을 약 25° 기울인 프레임 (눈 사이 거리 0.09) */
const headRoll25 = () =>
  analyze({
    move: {
      leftEyeOuter: { dy: -0.021 },
      rightEyeOuter: { dy: 0.021 },
    },
  })

/** 어깨선을 약 25° 기울인 프레임 (어깨 너비 0.24) */
const shoulderRoll25 = () =>
  analyze({
    move: {
      leftShoulder: { dy: -0.056 },
      rightShoulder: { dy: 0.056 },
    },
  })

/** 얼굴이 어깨 옆에 누운 형태 — 눈이 어깨 높이까지 내려온 프레임 */
const lyingDown = () =>
  analyze({
    move: {
      nose: { dy: 0.2 },
      leftEyeOuter: { dy: 0.2 },
      rightEyeOuter: { dy: 0.2 },
      leftEar: { dy: 0.2 },
      rightEar: { dy: 0.2 },
    },
  })

describe('lineRollDeg — 선 기울기 정규화', () => {
  it('점 순서와 무관하게 -90~90 범위를 돌려준다', () => {
    const p = { x: 0.4, y: 0.5, z: 0, visibility: 1, present: true }
    const q = { x: 0.6, y: 0.5, z: 0, visibility: 1, present: true }
    expect(lineRollDeg(p, q)).toBeCloseTo(0, 5)
    expect(lineRollDeg(q, p)).toBeCloseTo(0, 5)

    const tilted = { x: 0.6, y: 0.6, z: 0, visibility: 1, present: true }
    expect(Math.abs(lineRollDeg(p, tilted))).toBeCloseTo(26.57, 1)
    expect(Math.abs(lineRollDeg(tilted, p))).toBeCloseTo(26.57, 1)
  })
})

describe('캘리브레이션 프레이밍 게이트 — 심한 기울임 차단', () => {
  it('정면·가벼운 비대칭은 허용한다', () => {
    expect(checkCalibrationFraming(analyze()).ok).toBe(true)
    // 한쪽 어깨가 조금 높은 자세 (~7°)
    const slight = analyze({ move: { leftShoulder: { dy: -0.03 } } })
    expect(checkCalibrationFraming(slight).ok).toBe(true)
  })

  it('머리 roll 25° → invalid (head-roll)', () => {
    const verdict = checkCalibrationFraming(headRoll25())
    expect(verdict).toEqual({ ok: false, reason: 'head-roll' })
  })

  it('어깨 roll 25° → invalid (shoulder-roll)', () => {
    const verdict = checkCalibrationFraming(shoulderRoll25())
    expect(verdict).toEqual({ ok: false, reason: 'shoulder-roll' })
  })

  it('얼굴이 어깨 높이로 누운 형태 → invalid (not-upright)', () => {
    const verdict = checkCalibrationFraming(lyingDown())
    expect(verdict.ok).toBe(false)
  })

  it('얼굴 중심이 안전 영역 밖 → invalid', () => {
    const offscreen = analyze({
      move: {
        nose: { dx: 0.45 },
        leftEyeOuter: { dx: 0.45 },
        rightEyeOuter: { dx: 0.45 },
      },
    })
    expect(checkCalibrationFraming(offscreen).ok).toBe(false)
  })
})

describe('collectStep — 기울임 hard invalid 처리', () => {
  function collectValid(state: CollectState, from: number, to: number, stepMs = 100) {
    let s = state
    for (let now = from; now <= to; now += stepMs) {
      s = collectStep(s, { analysis: analyze(), now }).state
    }
    return s
  }

  it('기울어진 프레임에서는 표본이 쌓이지 않는다', () => {
    let s = createCollectState()
    // 프레이밍 통과 후 유효 표본 일부 수집
    s = collectValid(s, 0, FRAMING_MS + 800)
    expect(s.samples.length).toBeGreaterThan(0)

    // 머리 25° 기울임 → 표본 전체 삭제 + 수집 중단
    const r = collectStep(s, { analysis: headRoll25(), now: FRAMING_MS + 900 })
    expect(r.quality).toBe('tilted')
    expect(r.validCount).toBe(0)
    expect(r.state.samples).toHaveLength(0)
    expect(r.state.samplingStartedAt).toBeNull()
  })

  it('기울임 상태로는 아무리 오래 있어도 표본 0', () => {
    let s = createCollectState()
    for (let now = 0; now <= 8000; now += 100) {
      s = collectStep(s, { analysis: shoulderRoll25(), now }).state
      // timeout 등으로 초기화될 수 있으므로 매 스텝 표본 0 확인
      expect(s.samples).toHaveLength(0)
    }
  })

  it('hard invalid 후 정면 복귀 → 프레이밍 1.5초 + 5초 수집을 처음부터', () => {
    let s = createCollectState()
    s = collectValid(s, 0, FRAMING_MS + 1000)
    s = collectStep(s, { analysis: lyingDown(), now: FRAMING_MS + 1100 }).state

    // 복귀 직후: 프레이밍 단계부터 (완료 불가)
    const resume = FRAMING_MS + 1200
    let r = collectStep(s, { analysis: analyze(), now: resume })
    expect(r.step).toBe(1)
    expect(r.profile).toBeNull()

    // 프레이밍 1.5초 + 5초를 다시 채워야 완료된다
    s = r.state
    let profileAt: number | null = null
    for (let now = resume + 100; now <= resume + FRAMING_MS + TARGET_MS + 400; now += 100) {
      const step = collectStep(s, { analysis: analyze(), now })
      s = step.state
      if (step.profile) {
        profileAt = now
        break
      }
    }
    expect(profileAt).not.toBeNull()
    // 복귀 시점 기준 최소 1.5 + 5.0 초 뒤에야 완료
    expect(profileAt! - resume).toBeGreaterThanOrEqual(FRAMING_MS + TARGET_MS)
  })
})
