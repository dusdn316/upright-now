import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { CampusContributionKind, CampusOutboxItem } from './types'

/**
 * 기여 이벤트 durable outbox.
 *
 * 네트워크 단절·첫 익명 로그인 직후 지연·일시 서버 오류(PGRST303 등)로
 * 기여가 유실되지 않도록, 이벤트 생성 즉시 여기 기록하고 서버가
 * 확정(수락 또는 영구 거절)했을 때만 제거합니다.
 * eventId + 서버 unique 제약이 정확히-한-번 반영을 보장합니다.
 *
 * 저장 금지: 영상·프레임·랜드마크·자세 상태·자세 점수·개인 기준.
 */
const MAX_ITEMS = 200
const MAX_RETRY = 50

interface OutboxFile {
  schemaVersion: 1
  items: CampusOutboxItem[]
}

let cache: OutboxFile | null = null

function read(): OutboxFile {
  if (!cache) {
    const raw = loadLocal<Partial<OutboxFile> | null>(STORAGE_KEYS.campusOutbox, null)
    cache = {
      schemaVersion: 1,
      items: Array.isArray(raw?.items)
        ? raw.items.filter(
            (i): i is CampusOutboxItem =>
              Boolean(i) && typeof i.eventId === 'string' && typeof i.kind === 'string',
          )
        : [],
    }
  }
  return cache
}

function write(next: OutboxFile): void {
  cache = next
  saveLocal(STORAGE_KEYS.campusOutbox, next)
}

export function outboxItems(): CampusOutboxItem[] {
  return [...read().items]
}

export function outboxCount(): number {
  return read().items.length
}

export function enqueueOutbox(input: {
  eventId: string
  kind: CampusContributionKind
  sessionId: string | null
  targetTileId: string | null
  occurredAt: number
}): void {
  const file = read()
  if (file.items.some((i) => i.eventId === input.eventId)) return
  const items = [
    ...file.items,
    { ...input, retryCount: 0, lastError: null },
  ].slice(-MAX_ITEMS)
  write({ schemaVersion: 1, items })
}

/** 서버가 수락했거나 영구 거절한 이벤트를 제거합니다. */
export function resolveOutbox(eventId: string): void {
  const file = read()
  const items = file.items.filter((i) => i.eventId !== eventId)
  if (items.length !== file.items.length) write({ schemaVersion: 1, items })
}

/** 일시 실패 — 재시도 카운트와 마지막 오류만 갱신합니다. */
export function markOutboxRetry(eventId: string, lastError: string): void {
  const file = read()
  const items = file.items
    .map((i) =>
      i.eventId === eventId
        ? { ...i, retryCount: i.retryCount + 1, lastError: lastError.slice(0, 120) }
        : i,
    )
    // 무한 재시도 방지 — 상한 초과분은 폐기 (서버가 영영 안 받는 이벤트)
    .filter((i) => i.retryCount <= MAX_RETRY)
  write({ schemaVersion: 1, items })
}

/** 테스트 전용 */
export function resetOutboxForTest(): void {
  cache = null
  saveLocal(STORAGE_KEYS.campusOutbox, { schemaVersion: 1, items: [] })
}
