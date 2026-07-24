import {
  GOOD_RECOVERY_HOLD_MS,
  RECOVERY_COOLDOWN_MS,
  RECOVERY_WINDOW_MS,
} from '@/constants/posture'
import type { PostureEngineEvent, PostureState } from '@/types'

/**
 * 자세 상태 머신 — 순수 함수. 시간은 호출자가 넘긴 `now`(performance.now 기반)로만 흐릅니다.
 *
 * 지속 시간의 소유권 (중복 5초 지연 제거):
 * - "이탈 5초 지속" 검증은 상위 분류기(arbiter, classify.ts HOLD_MS)가 유일하게 소유합니다.
 * - 이 머신에 들어오는 bad 는 이미 지속 검증을 마친 확정(stable) bad 이므로,
 *   진입 즉시 회복 기회를 시작합니다. 여기서 다시 5초를 세지 않습니다.
 *
 * 규칙:
 * - 확정 bad 진입 + 냉각 아님 → 회복 기회 즉시 시작 (같은 구간 중복 시작 없음)
 * - 회복 기회 창 RECOVERY_WINDOW_MS(30s)
 * - good 이 GOOD_RECOVERY_HOLD_MS(5s) 연속 유지 → 회복 성공
 * - 성공/실패 후 RECOVERY_COOLDOWN_MS(20s) 냉각
 * - away·unstable 에서는 모든 회복 타이머를 "동결"합니다(실패·콤보 초기화 아님).
 *   복귀하면 남은 시간부터 이어서 계산합니다.
 */
export interface PostureMachineState {
  /** 확정 상태 (UI·게임이 보는 값) */
  state: PostureState
  /** 현재 상태로 들어온 시각 */
  enteredAt: number
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
  /** 확정 분류값 (arbiter 가 지속 시간 검증을 마친 값) */
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

  // 확정 상태는 분류기 출력을 그대로 따릅니다.
  const state = instant
  const enteredAt = state === prev.state ? prev.enteredAt : now

  let recovery = prev.recovery
  let cooldownUntil = prev.cooldownUntil

  // 1) 회복 기회 시작: 확정 bad + 냉각 아님 + 진행 중 기회 없음 → 즉시.
  //    (5초 지속 검증은 arbiter 가 이미 끝냈으므로 여기서 다시 기다리지 않습니다)
  if (recovery === null && state === 'bad' && now >= cooldownUntil) {
    recovery = { startedAt: now, elapsedMs: 0, goodHeldMs: 0 }
    events.push('recovery_started')
  } else if (recovery !== null) {
    // 2) 회복 기회 진행. away·unstable 에서는 창 시간과 good 유지 시간을 동결하고,
    //    복귀하면 남은 시간부터 이어서 계산합니다.
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
