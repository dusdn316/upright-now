import { describe, expect, it } from 'vitest'
import {
  createPostureMachine,
  reducePosture,
  type PostureMachineState,
} from './postureMachine'
import type { PostureEngineEvent, PostureState } from '@/types'

/** 순간 상태 스트림을 시간과 함께 흘려보내며 이벤트를 모읍니다. */
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

describe('postureMachine — 회복 수명주기 (docs/06 §10·§11)', () => {
  it('bad 5초 미만이면 회복 기회가 없다 (AT-03)', () => {
    const { events } = drive([
      { instant: 'bad', now: 0 },
      { instant: 'bad', now: 2000 },
      { instant: 'bad', now: 4000 },
    ])
    expect(events).not.toContain('recovery_started')
  })

  it('bad 5초 유지 → 회복 기회 시작', () => {
    const { events } = drive([
      { instant: 'bad', now: 0 },
      { instant: 'bad', now: 3000 },
      { instant: 'bad', now: 5000 },
    ])
    expect(events).toContain('recovery_started')
  })

  it('bad 5초 → good 5초 유지 → 회복 성공 정확히 1회 (AT-04)', () => {
    const { events } = drive([
      { instant: 'bad', now: 0 },
      { instant: 'bad', now: 5000 }, // 기회 시작
      { instant: 'good', now: 6000 },
      { instant: 'good', now: 9000 },
      { instant: 'good', now: 11000 }, // good 5초 유지 → 성공
      { instant: 'good', now: 13000 },
    ])
    expect(events.filter((e) => e === 'recovery_succeeded')).toHaveLength(1)
  })

  it('회복 창 30초 안에 good 5초를 못 채우면 실패', () => {
    const { events } = drive([
      { instant: 'bad', now: 0 },
      { instant: 'bad', now: 5000 }, // 기회 시작
      { instant: 'bad', now: 20000 },
      { instant: 'bad', now: 36000 }, // 창 초과
    ])
    expect(events).toContain('recovery_missed')
  })

  it('성공 후 20초 냉각 동안 새 회복 기회가 열리지 않는다', () => {
    // 성공까지
    const first = drive([
      { instant: 'bad', now: 0 },
      { instant: 'bad', now: 5000 },
      { instant: 'good', now: 6000 },
      { instant: 'good', now: 11000 }, // 성공, cooldownUntil = 11000+20000
    ])
    // 냉각 중 다시 bad 5초
    const second = drive(
      [
        { instant: 'bad', now: 12000 },
        { instant: 'bad', now: 18000 }, // 냉각 중(<31000) → 기회 없음
      ],
      first.state,
    )
    expect(second.events).not.toContain('recovery_started')
  })

  it('away·unstable 에서는 회복 창 시간과 good 유지 시간이 동결된다', () => {
    // 기회 시작 후 away 로 오래 있다가 돌아와도 실패 처리되지 않는다.
    const { state, events } = drive([
      { instant: 'bad', now: 0 },
      { instant: 'bad', now: 5000 }, // 기회 시작
      { instant: 'away', now: 6000 },
      { instant: 'away', now: 60000 }, // away 로 오래 (동결)
      { instant: 'away', now: 90000 },
    ])
    expect(events).not.toContain('recovery_missed')
    expect(state.recovery).not.toBeNull()
  })

  it('away·unstable 는 확정 상태로 반영되지만 실패로 처리하지 않는다', () => {
    const { state } = drive([
      { instant: 'good', now: 0 },
      { instant: 'unstable', now: 1000 },
    ])
    expect(state.state).toBe('unstable')
  })
})
