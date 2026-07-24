import type { PostureState, SessionStatus } from '@/types'

/**
 * 세션 타이머의 순수 계산부.
 * 시간은 호출자가 넘긴 delta로만 움직입니다. (테스트에서 시계가 필요 없도록)
 *
 * 규칙 (docs/02 FR-006·FR-007, docs/03 UF-08):
 * - 자세로 집중 여부를 추론하지 않습니다. 시작 버튼을 누른 시점부터 잽니다.
 * - away·unstable 에서도 타이머는 계속 흐릅니다. 보상만 멈춥니다.
 * - 감지 가능 시간(detectableMs)은 세션 시간과 분리해서 집계합니다.
 */
export interface SessionTimeState {
  status: SessionStatus
  plannedMs: number
  elapsedMs: number
  detectableMs: number
  awayMs: number
  unstableMs: number
}

export function createSessionTimeState(plannedMs: number): SessionTimeState {
  return {
    status: 'idle',
    plannedMs,
    elapsedMs: 0,
    detectableMs: 0,
    awayMs: 0,
    unstableMs: 0,
  }
}

export function tickSession(
  state: SessionTimeState,
  deltaMs: number,
  posture: PostureState,
): SessionTimeState {
  if (state.status !== 'running' || deltaMs <= 0) return state

  const elapsedMs = state.elapsedMs + deltaMs
  const reachedEnd = elapsedMs >= state.plannedMs

  return {
    ...state,
    elapsedMs: Math.min(elapsedMs, state.plannedMs),
    awayMs: state.awayMs + (posture === 'away' ? deltaMs : 0),
    unstableMs: state.unstableMs + (posture === 'unstable' ? deltaMs : 0),
    detectableMs:
      state.detectableMs +
      (posture === 'away' || posture === 'unstable' ? 0 : deltaMs),
    status: reachedEnd ? 'completed' : 'running',
  }
}

export function remainingMs(state: SessionTimeState): number {
  return Math.max(0, state.plannedMs - state.elapsedMs)
}

export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  // 1초 미만은 "0초" 대신 소수점으로 보여줍니다. (가장 빠른 회복 같은 값)
  if (ms > 0 && ms < 1000) return `${(ms / 1000).toFixed(1)}초`

  const totalSec = Math.max(0, Math.round(ms / 1000))
  const hour = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  if (hour > 0) {
    return `${hour}시간 ${min}분`
  }
  if (min > 0) {
    return `${min}분 ${sec}초`
  }
  return `${sec}초`
}
