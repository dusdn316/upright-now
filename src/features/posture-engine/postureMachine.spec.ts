import { describe, expect, it } from 'vitest'
import {
  createPostureMachine,
  reducePosture,
  type PostureMachineState,
} from './postureMachine'
import { arbiterStep, createArbiter, type ArbiterState } from './classify'
import type { PostureEngineEvent, PostureState } from '@/types'

/** 확정 상태 스트림을 시간과 함께 흘려보내며 이벤트를 모읍니다. */
function drive(
  steps: Array<{ instant: PostureState; now: number }>,
  start: PostureMachineState = createPostureMachine(0),
): { state: PostureMachineState; events: PostureEngineEvent[] } {
  let state = start
  const events: PostureEngineEvent[] = []
  for (const step of steps) {
    const result = reducePosture(state, step)
    state = result.state
    events.push(...result.events)
  }
  return { state, events }
}

/**
 * raw 이탈 → arbiter(5초 소유) → machine 통합 하네스.
 * 100ms 간격 프레임으로 bad 투표를 흘려보내고, arbiter 확정값을 머신에 넣습니다.
 */
function driveRaw(
  segments: Array<{ vote: 'bad' | 'good' | 'frozen-away'; durationMs: number }>,
): { events: PostureEngineEvent[]; startedAtMs: number | null } {
  let arbiter: ArbiterState = createArbiter()
  let machine = createPostureMachine(0)
  const events: PostureEngineEvent[] = []
  let startedAtMs: number | null = null
  let now = 0

  for (const segment of segments) {
    const end = now + segment.durationMs
    for (; now <= end; now += 100) {
      let instant: PostureState
      if (segment.vote === 'frozen-away') {
        // 분류기 fail 경로: arbiter 는 진행하지 않고 후보를 지웁니다.
        arbiter = { ...arbiter, candidate: null, candidateSince: now }
        instant = 'away'
      } else {
        arbiter = arbiterStep(
          arbiter,
          segment.vote === 'bad'
            ? { voteWarning: true, voteBad: true, voteGood: false }
            : { voteWarning: false, voteBad: false, voteGood: true },
          now,
        )
        instant = arbiter.current
      }
      const result = reducePosture(machine, { instant, now })
      machine = result.state
      for (const event of result.events) {
        events.push(event)
        if (event === 'recovery_started' && startedAtMs === null) {
          startedAtMs = now
        }
      }
    }
  }
  return { events, startedAtMs }
}

describe('회복 기회 타이밍 — 5초는 arbiter 단독 소유 (중복 지연 제거)', () => {
  it('raw 이탈 4.9초 → 회복 기회 없음', () => {
    const { events } = driveRaw([
      { vote: 'bad', durationMs: 4900 },
      { vote: 'good', durationMs: 1000 },
    ])
    expect(events).not.toContain('recovery_started')
  })

  it('raw 이탈 5.0초 → 회복 기회가 정확히 1회, 즉시 시작된다 (10초 아님)', () => {
    const { events, startedAtMs } = driveRaw([{ vote: 'bad', durationMs: 8000 }])

    expect(events.filter((e) => e === 'recovery_started')).toHaveLength(1)
    expect(startedAtMs).not.toBeNull()
    // 이탈 시작 후 5.0~5.3초 사이에 시작 (프레임 간격 100ms 오차 허용)
    expect(startedAtMs!).toBeGreaterThanOrEqual(5000)
    expect(startedAtMs!).toBeLessThan(5400)
  })

  it('같은 bad 구간에서 중복 시작이 없다', () => {
    // 기회 시작 후 계속 bad — 창(30s)이 끝나 miss 가 나기 전까지 재시작 없음
    const { events } = driveRaw([{ vote: 'bad', durationMs: 30_000 }])
    expect(events.filter((e) => e === 'recovery_started')).toHaveLength(1)
  })

  it('good 5초 유지 → 회복 보상 1회', () => {
    const { events } = driveRaw([
      { vote: 'bad', durationMs: 6000 }, // 5초 확정 + 기회 시작
      { vote: 'good', durationMs: 9000 }, // good 확정(2s) 후 5초 유지 → 성공
    ])
    expect(events.filter((e) => e === 'recovery_succeeded')).toHaveLength(1)
  })

  it('away 동안 확정용 지속 시간이 정지한다', () => {
    // bad 3초 → away 60초 → bad 3초: 연속 5초가 아니므로 기회 없음
    const { events } = driveRaw([
      { vote: 'bad', durationMs: 3000 },
      { vote: 'frozen-away', durationMs: 60_000 },
      { vote: 'bad', durationMs: 3000 },
    ])
    expect(events).not.toContain('recovery_started')
  })
})

describe('postureMachine — 확정 bad 는 즉시 기회를 연다', () => {
  it('확정 bad 진입 즉시 recovery_started (추가 5초 대기 없음)', () => {
    const { events } = drive([
      { instant: 'good', now: 0 },
      { instant: 'bad', now: 1000 },
    ])
    expect(events).toContain('recovery_started')
  })

  it('회복 창 30초 안에 good 5초를 못 채우면 실패', () => {
    const { events } = drive([
      { instant: 'bad', now: 0 }, // 즉시 기회 시작
      { instant: 'bad', now: 20_000 },
      { instant: 'bad', now: 31_000 }, // 창 초과
    ])
    expect(events).toContain('recovery_missed')
  })

  it('성공 후 20초 냉각 동안 새 회복 기회가 열리지 않는다', () => {
    const first = drive([
      { instant: 'bad', now: 0 }, // 기회 시작
      { instant: 'good', now: 1000 },
      { instant: 'good', now: 6100 }, // good 5초 유지 → 성공, 냉각 ~26.1s
    ])
    expect(first.events).toContain('recovery_succeeded')

    const second = drive(
      [
        { instant: 'bad', now: 8000 },
        { instant: 'bad', now: 20_000 }, // 냉각 중 → 기회 없음
      ],
      first.state,
    )
    expect(second.events).not.toContain('recovery_started')

    const third = drive(
      [{ instant: 'bad', now: 27_000 }], // 냉각 종료 후 → 새 기회
      second.state,
    )
    expect(third.events).toContain('recovery_started')
  })

  it('away·unstable 동안 회복 창이 동결되고, 복귀 후 남은 시간부터 계속된다', () => {
    const opened = drive([
      { instant: 'bad', now: 0 }, // 기회 시작 (창 30s)
      { instant: 'bad', now: 10_000 }, // 창 경과 10s
    ])
    expect(opened.state.recovery?.elapsedMs).toBe(10_000)

    // away 로 60초 — 창 시간이 흐르지 않고 실패도 아님
    const frozen = drive(
      [
        { instant: 'away', now: 11_000 },
        { instant: 'away', now: 71_000 },
      ],
      opened.state,
    )
    expect(frozen.events).not.toContain('recovery_missed')
    expect(frozen.state.recovery?.elapsedMs).toBe(10_000)

    // 복귀 → 남은 20초 안에서 이어서 진행, good 5초로 성공 가능
    const resumed = drive(
      [
        { instant: 'good', now: 72_000 },
        { instant: 'good', now: 77_100 },
      ],
      frozen.state,
    )
    expect(resumed.events).toContain('recovery_succeeded')
  })

  it('away·unstable 는 확정 상태로 반영되지만 실패로 처리하지 않는다', () => {
    const { state } = drive([
      { instant: 'good', now: 0 },
      { instant: 'unstable', now: 1000 },
    ])
    expect(state.state).toBe('unstable')
  })
})
