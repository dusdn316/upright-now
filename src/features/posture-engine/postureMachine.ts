import {
  BAD_HOLD_MS,
  GOOD_RECOVERY_HOLD_MS,
  RECOVERY_COOLDOWN_MS,
  RECOVERY_WINDOW_MS,
} from '@/constants/posture'
import type { PostureEngineEvent, PostureState } from '@/types'

/**
 * 자세 상태 머신 — 순수 함수. 시간은 호출자가 넘긴 `now`(performance.now 기반)로만 흐릅니다.
 *
 * QA Lab과 실제 MediaPipe가 이 하나의 머신을 공유합니다.
 * 두 경로 모두 "순간 분류값(instant)"과 현재 시각을 넣고, 머신이
 * bad 지속 → 회복 기회 → good 유지 → 회복 성공 → 냉각의 수명주기를 관리합니다.
 *
 * 규칙 (docs/06 §10·§11):
 * - bad 가 BAD_HOLD_MS(5s) 연속 → 회복 기회 시작
 * - 회복 기회 창 RECOVERY_WINDOW_MS(30s)
 * - good 이 GOOD_RECOVERY_HOLD_MS(5s) 연속 유지 → 회복 성공
 * - 성공/실패 후 RECOVERY_COOLDOWN_MS(20s) 냉각
 * - away·unstable 에서는 모든 회복 타이머를 "동결"합니다(실패·콤보 초기화 아님).
 */
export interface PostureMachineState {
  /** 확정 상태 (UI·게임이 보는 값) */
  state: PostureState
  /** 현재 상태로 들어온 시각 */
  enteredAt: number
  /** bad 가 연속으로 유지된 총 시간 */
  badHeldMs: number
  /** 회복 기회 */
  recovery: {
    startedAt: number
    /** 회복 기회 창에서 흐른 시간 (away/unstable 은 제외) */
    elapsedMs: number
    /** good 이 연속 유지된 시간 */
    goodHeldMs: number
  } | null
  /** 이 시각 전까지는 새 회복 기회를 열지 않습니다. */
  cooldownUntil: number
  /** 마지막으로 tick 한 시각 (델타 계산용) */
  lastTickAt: number
}

export interface PostureMachineInput {
  /** 순간 분류값 (이미 스무딩·히스테리시스를 거친 값) */
  instant: PostureState
  now: number
}

export interface PostureMachineResult {
  state: PostureMachineState
  events: PostureEngineEvent[]
  /** UI 표시용 회복 기회 정보 */
  recoveryOpportunity?: { active: boolean; remainingMs: number }
}

const FROZEN: ReadonlyArray<PostureState> = ['away', 'unstable']

export function createPostureMachine(now = 0): PostureMachineState {
  return {
    state: 'unstable',
    enteredAt: now,
    badHeldMs: 0,
    recovery: null,
    cooldownUntil: 0,
    lastTickAt: now,
  }
}

export function reducePosture(
  prev: PostureMachineState,
  input: PostureMachineInput,
): PostureMachineResult {
  const { instant, now } = input
  const deltaMs = Math.max(0, now - prev.lastTickAt)
  const frozen = FROZEN.includes(instant)
  const events: PostureEngineEvent[] = []

  // 확정 상태는 순간값을 그대로 따릅니다. (스무딩은 상위 분류기 담당)
  const state = instant
  const enteredAt = state === prev.state ? prev.enteredAt : now

  // bad 연속 시간
  const badHeldMs =
    state === 'bad' ? prev.badHeldMs + (prev.state === 'bad' ? deltaMs : 0) : 0

  let recovery = prev.recovery
  let cooldownUntil = prev.cooldownUntil

  // 1) 회복 기회 시작: bad 5초 연속 + 냉각 아님 + 진행 중 기회 없음
  if (
    recovery === null &&
    state === 'bad' &&
    badHeldMs >= BAD_HOLD_MS &&
    now >= cooldownUntil
  ) {
    recovery = { startedAt: now, elapsedMs: 0, goodHeldMs: 0 }
    events.push('recovery_started')
  } else if (recovery !== null) {
    // 2) 회복 기회 진행. away·unstable 에서는 창 시간과 good 유지 시간을 동결합니다.
    if (frozen) {
      // 아무 것도 진행하지 않음 (실패 처리도 안 함)
    } else {
      const elapsedMs = recovery.elapsedMs + deltaMs
      // good 이 끊기면 유지 시간을 0으로 되돌립니다.
      const goodHeldMs = state === 'good' ? recovery.goodHeldMs + deltaMs : 0

      if (goodHeldMs >= GOOD_RECOVERY_HOLD_MS) {
        // 3) 회복 성공
        events.push('recovery_succeeded')
        recovery = null
        cooldownUntil = now + RECOVERY_COOLDOWN_MS
      } else if (elapsedMs >= RECOVERY_WINDOW_MS) {
        // 4) 회복 실패 (창 시간 초과)
        events.push('recovery_missed')
        recovery = null
        cooldownUntil = now + RECOVERY_COOLDOWN_MS
      } else {
        recovery = { startedAt: recovery.startedAt, elapsedMs, goodHeldMs }
      }
    }
  }

  const next: PostureMachineState = {
    state,
    enteredAt,
    badHeldMs,
    recovery,
    cooldownUntil,
    lastTickAt: now,
  }

  return {
    state: next,
    events,
    recoveryOpportunity: recovery
      ? {
          active: true,
          remainingMs: Math.max(0, RECOVERY_WINDOW_MS - recovery.elapsedMs),
        }
      : undefined,
  }
}
