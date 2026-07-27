import { describe, expect, it } from 'vitest'
import { analyzeLandmarks } from './features'
import {
  arbiterStep,
  computeVotes,
  createArbiter,
  type ArbiterState,
  type FrameVotes,
} from './classify'
import { makeLandmarks, makeProfile } from './testFixtures'

const profile = makeProfile()

function votesFor(
  overrides: Parameters<typeof makeLandmarks>[0] = {},
  qualityGood = false,
): FrameVotes {
  const analysis = analyzeLandmarks(makeLandmarks(overrides))
  expect(analysis).not.toBeNull()
  return computeVotes(analysis!.features, profile, 'default', qualityGood)
}

describe('필수·선택 랜드마크 분리 (긴급 안정화 B)', () => {
  it('귀가 가려져도(visibility 낮음) 판정을 계속할 수 있다', () => {
    const analysis = analyzeLandmarks(
      makeLandmarks({ visibility: { leftEar: 0.1, rightEar: 0.1 } }),
    )!
    expect(analysis.earsOk).toBe(false)
    expect(analysis.faceCoreOk).toBe(true)
    expect(analysis.bothShouldersOk).toBe(true)
    // 주 특징 4개(얼굴·머리높이·좌우·어깨기울기) + torso 는 그대로 계산됨
    const votes = computeVotes(analysis.features, profile, 'default', false)
    expect(votes.details.filter((d) => d.primary).length).toBeGreaterThanOrEqual(2)
  })

  it('엉덩이가 화면 밖이어도 torso 특징만 제외하고 판정한다', () => {
    const analysis = analyzeLandmarks(
      makeLandmarks({ visibility: { leftHip: 0.1, rightHip: 0.1 } }),
    )!
    expect(analysis.hipsOk).toBe(false)
    expect(analysis.features.torsoLean).toBeUndefined()
    expect(analysis.excluded.torsoLean).toBeTruthy()
    const votes = computeVotes(analysis.features, profile, 'default', false)
    expect(votes.details.filter((d) => d.primary).length).toBeGreaterThanOrEqual(2)
  })

  it('한쪽 어깨가 없으면 필수 랜드마크 부족(unavailable 대상)이다', () => {
    const analysis = analyzeLandmarks(
      makeLandmarks({ visibility: { leftShoulder: 0.1 } }),
    )!
    expect(analysis.bothShouldersOk).toBe(false)
  })

  it('얼굴을 크게 옆으로 돌리면 severeRotation(측정 제한) 으로 잡힌다', () => {
    const analysis = analyzeLandmarks(
      makeLandmarks({ move: { nose: { dx: 0.05 } } }),
    )!
    expect(analysis.yawRatio).toBeGreaterThan(0.9)
    expect(analysis.severeRotation).toBe(true)
  })

  it('중간 정도 고개 돌림은 코 기반 특징만 제외하고 bad 로 판정하지 않는다', () => {
    // 두 번째 모니터를 보는 정도의 곁눈질 — 코만 옆으로 이동
    const analysis = analyzeLandmarks(
      makeLandmarks({ move: { nose: { dx: 0.03 } } }),
    )!
    expect(analysis.severeRotation).toBe(false)
    expect(analysis.moderateRotation).toBe(true)
    expect(analysis.features.lateralOffsetRatio).toBeUndefined()
    expect(analysis.excluded.lateralOffsetRatio).toBeTruthy()

    const votes = computeVotes(analysis.features, profile, 'default', false)
    expect(votes.voteWarning).toBe(false)
    expect(votes.voteBad).toBe(false)
  })
})

describe('투표 판정 (긴급 안정화 E)', () => {
  it('정면 기본 자세는 모든 특징이 good 범위다', () => {
    const votes = votesFor()
    expect(votes.voteWarning).toBe(false)
    expect(votes.voteBad).toBe(false)
    expect(votes.voteGood).toBe(true)
  })

  it('한 특징만 소폭 튀면 warning 투표는 되지만 bad 는 아니다', () => {
    // 머리 전체가 옆으로(코+눈 함께 → yaw 0) → lateralOffsetRatio 만 이탈
    // (tolerance 바닥 0.10, 0.03/0.24=0.125 → dev 1.25)
    const votes = votesFor({
      move: {
        nose: { dx: 0.03 },
        leftEyeOuter: { dx: 0.03 },
        rightEyeOuter: { dx: 0.03 },
      },
    })
    expect(votes.primaryExceedCount).toBe(1)
    expect(votes.voteWarning).toBe(true)
    expect(votes.voteBad).toBe(false)
  })

  it('두 특징이 함께 이탈하면 bad 투표', () => {
    // 얼굴이 커지고(접근) 눈-어깨 거리가 줄어듦(숙임)
    const votes = votesFor({
      move: {
        leftEyeOuter: { dx: 0.008, dy: 0.028 },
        rightEyeOuter: { dx: -0.008, dy: 0.028 },
        nose: { dy: 0.028 },
      },
    })
    expect(votes.primaryExceedCount).toBeGreaterThanOrEqual(2)
    expect(votes.voteBad).toBe(true)
  })

  it('한 특징이 1.8 을 넘고 품질이 good 이면 bad 투표', () => {
    const strong = {
      move: {
        nose: { dx: 0.04 * 0 }, // no-op 유지
        leftEyeOuter: { dy: 0.06 },
        rightEyeOuter: { dy: 0.06 },
      },
    }
    const withGood = votesFor(strong, true)
    expect(withGood.maxPrimary).toBeGreaterThan(1.8)
    expect(withGood.voteBad).toBe(true)

    const withLimited = votesFor(strong, false)
    expect(withLimited.voteBad).toBe(false)
  })

  it('z(forwardDepth)만 튀면 warning 도 bad 도 아니고 good 복귀도 막지 않는다', () => {
    const votes = votesFor({ move: { nose: { dz: -0.6 } } })
    const aux = votes.details.find((d) => d.key === 'forwardDepthRatio')
    expect(aux?.exceeded).toBe(true)
    expect(votes.voteWarning).toBe(false)
    expect(votes.voteBad).toBe(false)
    // z 는 good 복귀의 거부권이 없습니다 — 주 특징이 모두 기준 안이면 good.
    expect(votes.voteGood).toBe(true)
  })

  it('z 는 주 특징 1개와 함께여도 bad 의 두 번째 표가 되지 않는다 (보조 신호)', () => {
    // 실카메라의 z 는 조명·거리에 따라 흘러다녀 marginal 한 주 특징을
    // bad 로 승격시키던 오탐 원인이었습니다.
    const votes = votesFor({
      move: {
        nose: { dz: -0.6 },
        leftEyeOuter: { dy: 0.028 },
        rightEyeOuter: { dy: 0.028 },
      },
    })
    expect(votes.primaryExceedCount).toBe(1)
    expect(votes.auxExceedCount).toBe(1)
    expect(votes.voteWarning).toBe(true)
    expect(votes.voteBad).toBe(false)
  })

  it('편안한 자세의 미세 흔들림은 30초가 지나도 good 을 유지한다', () => {
    // 12fps × 30초, 프레임마다 작은 흔들림(머리 ±1%, 상하 ±0.5%)을 주입
    let arbiter = createArbiter()
    let becameNonGood = false
    for (let frame = 0; frame < 12 * 30; frame += 1) {
      const wobble = frame % 4
      const dx = (wobble === 0 ? 1 : wobble === 2 ? -1 : 0) * 0.01
      const dy = (wobble === 1 ? 1 : wobble === 3 ? -1 : 0) * 0.005
      const votes = votesFor({
        move: {
          nose: { dx, dy },
          leftEyeOuter: { dx, dy },
          rightEyeOuter: { dx, dy },
        },
      })
      arbiter = arbiterStep(arbiter, votes, (frame * 1000) / 12)
      if (arbiter.current !== 'good') becameNonGood = true
    }
    expect(becameNonGood).toBe(false)
    expect(arbiter.current).toBe('good')
  })
})

describe('지속 시간 확정 (arbiter)', () => {
  const BAD = { voteWarning: true, voteBad: true, voteGood: false }
  const WARN = { voteWarning: true, voteBad: false, voteGood: false }
  const GOOD = { voteWarning: false, voteBad: false, voteGood: true }
  const MID = { voteWarning: false, voteBad: false, voteGood: false }

  function run(
    steps: Array<[typeof BAD, number]>,
    start: ArbiterState = createArbiter(),
  ): ArbiterState {
    let state = start
    for (const [votes, now] of steps) state = arbiterStep(state, votes, now)
    return state
  }

  it('warning 은 1.5초 지속 후 확정된다', () => {
    expect(run([[WARN, 0], [WARN, 1000]]).current).toBe('good')
    expect(run([[WARN, 0], [WARN, 1000], [WARN, 1600]]).current).toBe('warning')
  })

  it('bad 는 5초 지속 후 확정된다', () => {
    const mid = run([[BAD, 0], [BAD, 3000]])
    expect(mid.current).toBe('good')
    expect(run([[BAD, 0], [BAD, 3000], [BAD, 5100]]).current).toBe('bad')
  })

  it('good 복귀는 2초 지속이 필요하다', () => {
    const bad = run([[BAD, 0], [BAD, 5100]])
    expect(bad.current).toBe('bad')
    const back = run([[GOOD, 6000], [GOOD, 7000], [GOOD, 8200]], bad)
    expect(back.current).toBe('good')
  })

  it('중간 지대에서는 현재 상태를 유지한다 (히스테리시스)', () => {
    const warn = run([[WARN, 0], [WARN, 1600]])
    expect(warn.current).toBe('warning')
    const held = run([[MID, 2000], [MID, 10000]], warn)
    expect(held.current).toBe('warning')
  })

  it('한 프레임 튐으로는 상태가 바뀌지 않는다', () => {
    const state = run([[GOOD, 0], [BAD, 100], [GOOD, 200], [GOOD, 2300]])
    expect(state.current).toBe('good')
  })
})
