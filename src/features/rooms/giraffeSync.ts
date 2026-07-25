/**
 * 기린 싱크 — 서로 다른 두 참가자의 recovery_earned 가 10초 안에 발생하면
 * 합동 공격 1회. 같은 회복 이벤트는 재사용하지 않습니다. (docs/08 §11)
 */
export const GIRAFFE_SYNC_WINDOW_MS = 10_000

interface RecoveryMark {
  eventId: string
  participantId: string
  timestamp: number
  used: boolean
}

export interface GiraffeSyncState {
  marks: RecoveryMark[]
}

export interface GiraffeSyncResult {
  state: GiraffeSyncState
  /** 이번 이벤트로 싱크가 성립했는지 */
  sync: boolean
  /** 싱크에 사용된 두 이벤트 id (중복 피해 방지용 결정적 id 생성에 사용) */
  pairIds?: [string, string]
}

export function createGiraffeSync(): GiraffeSyncState {
  return { marks: [] }
}

export function registerRecovery(
  state: GiraffeSyncState,
  event: { eventId: string; participantId: string; timestamp: number },
): GiraffeSyncResult {
  // 같은 이벤트 재등록 금지
  if (state.marks.some((m) => m.eventId === event.eventId)) {
    return { state, sync: false }
  }

  const mark: RecoveryMark = { ...event, used: false }

  // 다른 참가자의 미사용 회복 중 10초 이내인 것을 찾습니다.
  const partner = state.marks.find(
    (m) =>
      !m.used &&
      m.participantId !== event.participantId &&
      Math.abs(event.timestamp - m.timestamp) <= GIRAFFE_SYNC_WINDOW_MS,
  )

  // 오래된 기록은 정리합니다.
  const fresh = state.marks.filter(
    (m) => event.timestamp - m.timestamp <= GIRAFFE_SYNC_WINDOW_MS * 2,
  )

  if (partner) {
    return {
      state: {
        marks: [
          ...fresh.map((m) =>
            m.eventId === partner.eventId ? { ...m, used: true } : m,
          ),
          { ...mark, used: true },
        ],
      },
      sync: true,
      pairIds: [partner.eventId, event.eventId].sort() as [string, string],
    }
  }

  return { state: { marks: [...fresh, mark] }, sync: false }
}
