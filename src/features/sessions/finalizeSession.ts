import { useSessionStore } from './sessionStore'
import { useSessionHistoryStore } from './sessionHistoryStore'
import { buildSessionSummary } from './buildSummary'
import { useGameStore } from '@/features/game/gameStore'
import { applyReward } from '@/features/game/rewards'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { registerSessionLockRelease } from './sessionLocks'
import { useRoomStore } from '@/features/rooms/roomStore'
import { reportSessionComplete } from '@/features/rooms/roomService'

/**
 * 세션 종료의 단일 진입점 — atomic 하게 한 번만 실행됩니다.
 *
 * 순서: summary 저장 → 보상 이벤트 적용 → progression·출석 갱신 → 상태 확정.
 * sessionId 기준으로 중복 종료·중복 보상을 막습니다.
 *
 * 완료 인정: 타이머 정상 종료 또는 계획 시간의 80% 이상 진행 후 종료.
 * 17초 중도 종료는 완료 세션·출석·완주 보상에 포함되지 않습니다.
 */
export const COMPLETION_RATIO = 0.8

const finalizedSessionIds = new Set<string>()

// 세션 재시작 시 종료 잠금을 풉니다.
registerSessionLockRelease((sessionId) => finalizedSessionIds.delete(sessionId))

export function finalizeSession(reason: 'timer' | 'manual'): {
  completed: boolean
  alreadyFinalized: boolean
} {
  const session = useSessionStore.getState()
  const { sessionId } = session

  if (finalizedSessionIds.has(sessionId)) {
    return { completed: session.status === 'completed', alreadyFinalized: true }
  }
  finalizedSessionIds.add(sessionId)

  const completed =
    reason === 'timer' ||
    (session.plannedMs > 0 && session.elapsedMs >= COMPLETION_RATIO * session.plannedMs)

  const status = completed ? ('completed' as const) : ('aborted' as const)
  const isDemo = useDemoStore.getState().isDemo

  if (completed) {
    // 기본 공격 (eventId 로 중복 차단)
    useGameStore.getState().sessionCompleted(`session-complete-${sessionId}`)
    // 친구 방 세션이면 공동 보스에도 완주 공격을 보냅니다.
    if (useRoomStore.getState().phase === 'running') {
      void reportSessionComplete()
    }
    // 완주 보상 — 반드시 applyReward 를 통해서만
    applyReward({
      id: `session-complete-xp-${sessionId}`,
      sessionId,
      type: 'session_completed',
    })
    if (!isDemo) {
      const dateKey = new Date().toISOString().slice(0, 10)
      useProgressionStore.getState().completeSessionMark(dateKey)
    }
  }

  // 기록 저장 — 중도 종료도 기록은 남기되 완료로 세지 않습니다.
  if (!isDemo && session.elapsedMs > 0) {
    useSessionHistoryStore
      .getState()
      .add(
        buildSessionSummary(
          useSessionStore.getState(),
          useGameStore.getState(),
          status,
        ),
      )
  }

  useSessionStore.getState().finish(status)

  return { completed, alreadyFinalized: false }
}

/** 새 세션 시작 시 같은 id 재사용을 허용하기 위해 호출합니다. */
export function releaseFinalizedSession(sessionId: string): void {
  finalizedSessionIds.delete(sessionId)
}

/** 테스트 전용 */
export function resetFinalizedForTest(): void {
  finalizedSessionIds.clear()
}
