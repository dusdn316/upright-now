import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { CAMPUS_SCHOOLS, CUSTOM_SCHOOL_ID } from '@/constants/campus'
import { createSeasonMap } from './campusMap'
import { seasonAt } from './season'
import { applyContributionToTile, countTilesBySchool } from './territory'
import { withNormalizedScore } from './contribution'
import type { CampusRepository, CampusSubmitResult } from './repository'
import type {
  CampusArchivedSeason,
  CampusContributionEvent,
  CampusSchoolStanding,
  CampusSeason,
  CampusSnapshot,
  CampusTile,
  CampusTileEvent,
} from './types'

/**
 * 로컬 mock 저장소.
 *
 * Supabase 없이도 지도·점령·기여도·시즌 흐름을 전부 확인할 수 있게 합니다.
 * 같은 브라우저의 두 탭은 BroadcastChannel 로 즉시 동기화되고,
 * 같은 JS 컨텍스트의 두 인스턴스는 로컬 리스너로 즉시 동기화됩니다.
 *
 * 여기에는 카메라·랜드마크·자세 좌표·`bad` 상태가 저장되지 않습니다.
 */
const MAX_TILE_EVENTS = 60
const MAX_PROCESSED_EVENTS = 500
const CHANNEL_NAME = 'upright-now:campus-mock'

interface MockState {
  season: CampusSeason
  tiles: CampusTile[]
  tileEvents: CampusTileEvent[]
  /** 학교별 총 기여도 */
  totals: Record<string, number>
  /** 학교별 활성 기여자 (익명 memberId) */
  contributors: Record<string, string[]>
  /** `${schoolId}:${memberId}` → 기여도. 학교를 바꾸면 새 키가 되므로 이전 기여도는 옮겨지지 않습니다. */
  memberTotals: Record<string, number>
  /** eventId 멱등성 */
  processedEventIds: string[]
  archived: CampusArchivedSeason[]
}

export interface CampusIdentity {
  memberId: string
  schoolId: string | null
}

/* ------------------------------ 결정적 시드 ------------------------------- */

/** 문자열 → 32bit 시드 */
function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function createRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

const SEEDABLE_SCHOOLS = CAMPUS_SCHOOLS.filter((s) => s.id !== CUSTOM_SCHOOL_ID).map(
  (s) => s.id,
)

/**
 * Preview 에서 지도가 비어 보이지 않게 mock 데이터를 채웁니다.
 * 시즌 id 기준 결정적 생성이므로, 새로고침해도 같은 지도가 나옵니다.
 */
function seedState(season: CampusSeason, now: number): MockState {
  const random = createRandom(hashSeed(season.id))
  const tiles = createSeasonMap(season.id, now)
  const totals: Record<string, number> = {}
  const contributors: Record<string, string[]> = {}
  const tileEvents: CampusTileEvent[] = []

  // 학교 규모를 일부러 다르게 둡니다 (총 기여도만 보면 큰 학교가 이기는 상황 재현).
  SEEDABLE_SCHOOLS.forEach((schoolId, index) => {
    const size = 3 + Math.floor(random() * 28)
    contributors[schoolId] = Array.from(
      { length: size },
      (_, i) => `seed-${schoolId}-${i}`,
    )
    totals[schoolId] = 400 + Math.floor(random() * 90) * 20 + index * 40
  })

  for (const tile of tiles) {
    const roll = random()
    // 약 45% 는 중립으로 남겨 둡니다.
    if (roll < 0.45) continue
    const owner = SEEDABLE_SCHOOLS[Math.floor(random() * SEEDABLE_SCHOOLS.length)]
    tile.ownerSchoolId = owner
    tile.defenseScore += Math.floor(random() * 12) * 20
    tile.updatedAt = now - Math.floor(random() * 6 * 60 * 60 * 1000)

    // 약 18% 는 다른 학교가 공격 중 — 그중 일부는 경합(80% 이상) 상태로 보여 줍니다.
    if (random() < 0.18) {
      const others = SEEDABLE_SCHOOLS.filter((id) => id !== owner)
      const challenger = others[Math.floor(random() * others.length)]
      const ratio = random() < 0.45 ? 0.82 + random() * 0.15 : random() * 0.7
      tile.challengerSchoolId = challenger
      tile.challengeScore = Math.round(tile.defenseScore * ratio)
      if (ratio >= 0.8) {
        tileEvents.push({
          id: `${tile.id}:seed-contested`,
          seasonId: season.id,
          tileId: tile.id,
          kind: 'contested',
          fromSchoolId: owner,
          toSchoolId: challenger,
          at: tile.updatedAt,
        })
      }
    }
  }

  // 최근 점령 로그도 몇 개 심어 둡니다.
  const owned = tiles.filter((t) => t.ownerSchoolId)
  for (let i = 0; i < Math.min(8, owned.length); i += 1) {
    const tile = owned[Math.floor(random() * owned.length)]
    tileEvents.push({
      id: `${tile.id}:seed-captured-${i}`,
      seasonId: season.id,
      tileId: tile.id,
      kind: 'captured',
      fromSchoolId: null,
      toSchoolId: tile.ownerSchoolId,
      at: now - Math.floor(random() * 8 * 60 * 60 * 1000),
    })
  }

  return {
    season,
    tiles,
    tileEvents: sortEvents(tileEvents).slice(0, MAX_TILE_EVENTS),
    totals,
    contributors,
    memberTotals: {},
    processedEventIds: [],
    archived: [],
  }
}

function sortEvents(events: CampusTileEvent[]): CampusTileEvent[] {
  return [...events].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

/* ------------------------------ 공유 상태 관리 ---------------------------- */

let shared: MockState | null = null
const localListeners = new Set<(state: MockState) => void>()
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent) => {
      const incoming = event.data as MockState | undefined
      if (!incoming || !incoming.season) return
      shared = incoming
      for (const listener of localListeners) listener(incoming)
    }
    return channel
  } catch {
    return null
  }
}

function persist(state: MockState): void {
  saveLocal(STORAGE_KEYS.campusMock, state)
}

function publish(state: MockState): void {
  shared = state
  persist(state)
  for (const listener of localListeners) listener(state)
  getChannel()?.postMessage(state)
}

/** 시즌이 끝났으면 최종 지도를 보관하고 새 시즌 지도를 초기화합니다. */
function rolloverIfNeeded(state: MockState, now: number): MockState {
  const current = seasonAt(now)
  if (current.id === state.season.id) return state

  const archivedEntry: CampusArchivedSeason = {
    season: { ...state.season, status: 'archived' },
    tiles: state.tiles,
    standings: computeStandings(state),
  }
  const fresh = seedState(current, now)
  return {
    ...fresh,
    archived: [archivedEntry, ...state.archived].slice(0, 8),
  }
}

function loadShared(now: number): MockState {
  if (!shared) {
    const stored = loadLocal<MockState | null>(STORAGE_KEYS.campusMock, null)
    shared =
      stored && stored.season && Array.isArray(stored.tiles)
        ? stored
        : seedState(seasonAt(now), now)
  }
  const rolled = rolloverIfNeeded(shared, now)
  if (rolled !== shared) publish(rolled)
  return shared
}

function computeStandings(state: MockState): CampusSchoolStanding[] {
  const tileCounts = countTilesBySchool(state.tiles)
  const schoolIds = new Set<string>([
    ...Object.keys(state.totals),
    ...Object.keys(tileCounts),
  ])
  return [...schoolIds].map((schoolId) =>
    withNormalizedScore({
      schoolId,
      totalContribution: state.totals[schoolId] ?? 0,
      activeContributors: state.contributors[schoolId]?.length ?? 0,
      tiles: tileCounts[schoolId] ?? 0,
    }),
  )
}

function toSnapshot(state: MockState, identity: CampusIdentity): CampusSnapshot {
  const key = identity.schoolId ? `${identity.schoolId}:${identity.memberId}` : null
  return {
    season: state.season,
    tiles: state.tiles,
    standings: computeStandings(state),
    tileEvents: state.tileEvents,
    // 학교를 바꾸면 키가 바뀌므로 이전 학교 기여도가 따라오지 않습니다.
    myContribution: key ? (state.memberTotals[key] ?? 0) : 0,
    archived: state.archived,
  }
}

/** 테스트 전용 — 공유 상태를 비웁니다. */
export function resetMockCampusForTest(): void {
  shared = null
  localListeners.clear()
  if (channel) {
    channel.onmessage = null
    channel.close()
    channel = null
  }
}

/* -------------------------------- 저장소 --------------------------------- */

export class MockCampusRepository implements CampusRepository {
  readonly kind = 'mock' as const

  private listeners = new Set<(snapshot: CampusSnapshot) => void>()
  private bridge: ((state: MockState) => void) | null = null
  private readonly identity: () => CampusIdentity
  private readonly now: () => number

  constructor(identity: () => CampusIdentity, now: () => number = () => Date.now()) {
    this.identity = identity
    this.now = now
  }

  async load(): Promise<CampusSnapshot> {
    return toSnapshot(loadShared(this.now()), this.identity())
  }

  subscribe(listener: (snapshot: CampusSnapshot) => void): () => void {
    this.listeners.add(listener)
    if (!this.bridge) {
      this.bridge = (state) => {
        const snapshot = toSnapshot(state, this.identity())
        for (const l of this.listeners) l(snapshot)
      }
      localListeners.add(this.bridge)
      getChannel()
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  async submitContribution(event: CampusContributionEvent): Promise<CampusSubmitResult> {
    const at = event.occurredAt
    const state = loadShared(at)

    // eventId 멱등성 — 같은 이벤트는 두 번 반영되지 않습니다.
    if (state.processedEventIds.includes(event.eventId)) {
      return { accepted: false, points: 0, reason: 'duplicate_event' }
    }

    const index = state.tiles.findIndex((t) => t.id === event.tileId)
    if (index < 0) return { accepted: false, points: 0, reason: 'not_ready' }

    const result = applyContributionToTile(
      state.tiles[index],
      event.schoolId,
      event.points,
      at,
    )

    const tiles = [...state.tiles]
    tiles[index] = result.tile

    const memberKey = `${event.schoolId}:${event.memberId}`
    const existingContributors = state.contributors[event.schoolId] ?? []
    const contributors = existingContributors.includes(event.memberId)
      ? existingContributors
      : [...existingContributors, event.memberId]

    publish({
      ...state,
      tiles,
      tileEvents: sortEvents([...result.events, ...state.tileEvents]).slice(
        0,
        MAX_TILE_EVENTS,
      ),
      totals: {
        ...state.totals,
        [event.schoolId]: (state.totals[event.schoolId] ?? 0) + event.points,
      },
      contributors: { ...state.contributors, [event.schoolId]: contributors },
      memberTotals: {
        ...state.memberTotals,
        [memberKey]: (state.memberTotals[memberKey] ?? 0) + event.points,
      },
      processedEventIds: [...state.processedEventIds, event.eventId].slice(
        -MAX_PROCESSED_EVENTS,
      ),
    })

    return {
      accepted: true,
      points: event.points,
      captured: result.captured,
      contested: result.contested,
      tileId: result.tile.id,
    }
  }

  dispose(): void {
    this.listeners.clear()
    if (this.bridge) {
      localListeners.delete(this.bridge)
      this.bridge = null
    }
  }
}
