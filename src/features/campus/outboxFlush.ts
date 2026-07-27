import { outboxItems, resolveOutbox, markOutboxRetry } from './outbox'
import {
  applyAuthoritativeResult,
  getCampusRepository,
  syncPendingCount,
} from './campusStore'

/**
 * outbox 재전송 — 앱 시작·online 복귀·Realtime 재연결·캠퍼스 화면 진입 때
 * 호출됩니다. eventId + 서버 unique 제약으로 정확히 한 번만 반영됩니다.
 */
let flushing = false

export async function flushCampusOutbox(): Promise<void> {
  if (flushing) return
  const repository = getCampusRepository()
  if (!repository || repository.kind !== 'supabase') return
  const items = outboxItems()
  if (items.length === 0) return

  flushing = true
  try {
    for (const item of items) {
      const result = await repository.submitContribution({
        eventId: item.eventId,
        kind: item.kind,
        seasonId: '',
        schoolId: '',
        memberId: '',
        sessionId: item.sessionId,
        tileId: item.targetTileId ?? '',
        points: 0,
        occurredAt: item.occurredAt,
      })

      if (result.accepted) {
        resolveOutbox(item.eventId)
        applyAuthoritativeResult(result)
        continue
      }
      if (result.reason && result.reason !== 'not_ready') {
        // 영구 거절(중복·상한·유효성) — 재시도해도 같으므로 제거합니다.
        resolveOutbox(item.eventId)
        continue
      }
      // 일시 실패 — 남겨 두고 이번 flush 는 멈춥니다(다음 트리거에서 재시도).
      markOutboxRetry(item.eventId, result.reason ?? 'network')
      break
    }
  } finally {
    flushing = false
    syncPendingCount()
  }
}
