import type { RealtimeChannel } from '@supabase/supabase-js'
import { ensureAnonymousUser, getSupabase } from '@/lib/supabase/client'
import { withNormalizedScore } from './contribution'
import { countTilesBySchool } from './territory'
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
 * Supabase 저장소 — supabase/campus_territory_migration.sql 과 짝을 이룹니다.
 *
 * 이 파일은 migration 을 적용한 프로젝트에서만 동작합니다.
 * Production Supabase 에는 migration 을 적용하지 않았으므로, 기본 경로는 mock 입니다.
 * (campusStore 가 `VITE_ENABLE_CAMPUS_SUPABASE` 없이는 mock 을 씁니다.)
 *
 * 전송하는 것: 학교 id · 시즌 id · 타일 id · 기여 종류 · 점수뿐입니다.
 * 카메라 영상·프레임·랜드마크·자세 좌표·`bad` 상태는 전송하지 않습니다.
 */
/** 최종 지도까지 함께 불러올 보관 시즌 수 */
const ARCHIVED_DETAIL_LIMIT = 3

interface TileRow {
  id: string
  season_id: string
  x: number
  y: number
  zone: string
  owner_school_id: string | null
  challenger_school_id: string | null
  defense_score: number
  challenge_score: number
  updated_at: string
}

interface TileEventRow {
  id: string
  season_id: string
  tile_id: string
  kind: string
  from_school_id: string | null
  to_school_id: string | null
  created_at: string
}

interface SeasonRow {
  id: string
  name: string
  starts_at: string
  ends_at: string
  status: string
}

interface StandingRow {
  school_id: string
  total_contribution: number
  active_contributors: number
  tiles: number
}

function toTile(row: TileRow): CampusTile {
  return {
    id: row.id,
    seasonId: row.season_id,
    x: row.x,
    y: row.y,
    zone: row.zone as CampusTile['zone'],
    ownerSchoolId: row.owner_school_id,
    challengerSchoolId: row.challenger_school_id,
    defenseScore: row.defense_score,
    challengeScore: row.challenge_score,
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function toSeason(row: SeasonRow): CampusSeason {
  return {
    id: row.id,
    name: row.name,
    startsAt: new Date(row.starts_at).getTime(),
    endsAt: new Date(row.ends_at).getTime(),
    status: row.status === 'archived' ? 'archived' : 'active',
  }
}

function toTileEvent(row: TileEventRow): CampusTileEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    tileId: row.tile_id,
    kind: row.kind as CampusTileEvent['kind'],
    fromSchoolId: row.from_school_id,
    toSchoolId: row.to_school_id,
    at: new Date(row.created_at).getTime(),
  }
}

export class SupabaseCampusRepository implements CampusRepository {
  readonly kind = 'supabase' as const

  private channel: RealtimeChannel | null = null
  private listeners = new Set<(snapshot: CampusSnapshot) => void>()
  private last: CampusSnapshot | null = null
  /**
   * 보관 시즌은 더 이상 변하지 않으므로 한 번만 불러옵니다.
   * Realtime 갱신마다 지난 시즌 타일을 다시 조회하지 않기 위한 캐시입니다.
   */
  private archivedCache: { key: string; value: CampusArchivedSeason[] } | null = null

  async load(): Promise<CampusSnapshot> {
    const supabase = await getSupabase()
    if (!supabase) throw new Error('supabase-not-configured')
    await ensureAnonymousUser()

    const { data: seasonRow } = await supabase
      .from('campus_seasons')
      .select('id, name, starts_at, ends_at, status')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!seasonRow) throw new Error('no-active-season')
    const season = toSeason(seasonRow as SeasonRow)

    const [tiles, events, standings, mine, archived] = await Promise.all([
      supabase
        .from('campus_tiles')
        .select(
          'id, season_id, x, y, zone, owner_school_id, challenger_school_id, defense_score, challenge_score, updated_at',
        )
        .eq('season_id', season.id),
      supabase
        .from('campus_tile_events')
        .select('id, season_id, tile_id, kind, from_school_id, to_school_id, created_at')
        .eq('season_id', season.id)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.rpc('campus_season_standings', { p_season_id: season.id }),
      supabase.rpc('campus_my_contribution', { p_season_id: season.id }),
      supabase
        .from('campus_seasons')
        .select('id, name, starts_at, ends_at, status')
        .eq('status', 'archived')
        .order('starts_at', { ascending: false })
        .limit(8),
    ])

    const tileList = ((tiles.data ?? []) as TileRow[]).map(toTile)
    const tileCounts = countTilesBySchool(tileList)
    const standingList: CampusSchoolStanding[] = (
      (standings.data ?? []) as StandingRow[]
    ).map((row) =>
      withNormalizedScore({
        schoolId: row.school_id,
        totalContribution: row.total_contribution,
        activeContributors: row.active_contributors,
        tiles: tileCounts[row.school_id] ?? 0,
      }),
    )

    // 보관된 시즌은 최종 지도와 학교별 기여도까지 함께 불러옵니다.
    // 개수를 제한하고 캐시해 Realtime 갱신마다 다시 조회하지 않습니다.
    const archivedRows = ((archived.data ?? []) as SeasonRow[]).slice(
      0,
      ARCHIVED_DETAIL_LIMIT,
    )
    const archivedKey = archivedRows.map((r) => r.id).join(',')
    let archivedList: CampusArchivedSeason[]
    if (this.archivedCache?.key === archivedKey) {
      archivedList = this.archivedCache.value
    } else {
      archivedList = await Promise.all(
        archivedRows.map(async (row) => {
          const archivedSeason = toSeason(row)
          const [archivedTiles, archivedStandings] = await Promise.all([
            supabase
              .from('campus_tiles')
              .select(
                'id, season_id, x, y, zone, owner_school_id, challenger_school_id, defense_score, challenge_score, updated_at',
              )
              .eq('season_id', archivedSeason.id),
            supabase.rpc('campus_season_standings', { p_season_id: archivedSeason.id }),
          ])
          const tilesOfSeason = ((archivedTiles.data ?? []) as TileRow[]).map(toTile)
          const counts = countTilesBySchool(tilesOfSeason)
          return {
            season: archivedSeason,
            tiles: tilesOfSeason,
            standings: ((archivedStandings.data ?? []) as StandingRow[]).map((s) =>
              withNormalizedScore({
                schoolId: s.school_id,
                totalContribution: s.total_contribution,
                activeContributors: s.active_contributors,
                tiles: counts[s.school_id] ?? 0,
              }),
            ),
          }
        }),
      )
      this.archivedCache = { key: archivedKey, value: archivedList }
    }

    const snapshot: CampusSnapshot = {
      season,
      tiles: tileList,
      standings: standingList,
      tileEvents: ((events.data ?? []) as TileEventRow[]).map(toTileEvent),
      myContribution: typeof mine.data === 'number' ? mine.data : 0,
      archived: archivedList,
    }
    this.last = snapshot
    return snapshot
  }

  subscribe(listener: (snapshot: CampusSnapshot) => void): () => void {
    this.listeners.add(listener)

    if (!this.channel) {
      void (async () => {
        const supabase = await getSupabase()
        if (!supabase) return
        this.channel = supabase
          .channel('campus-territory')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'campus_tiles' },
            () => void this.refresh(),
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'campus_tile_events' },
            () => void this.refresh(),
          )
          .subscribe()
      })()
    }

    return () => {
      this.listeners.delete(listener)
    }
  }

  private async refresh(): Promise<void> {
    try {
      const snapshot = await this.load()
      for (const listener of this.listeners) listener(snapshot)
    } catch {
      // 실시간 갱신 실패는 조용히 넘어갑니다. 다음 이벤트에서 다시 시도합니다.
      if (this.last) for (const listener of this.listeners) listener(this.last)
    }
  }

  async submitContribution(event: CampusContributionEvent): Promise<CampusSubmitResult> {
    const supabase = await getSupabase()
    if (!supabase) return { accepted: false, points: 0, reason: 'not_ready' }
    await ensureAnonymousUser()

    // 원자적 RPC — eventId 멱등성과 타일 점령 판정을 서버가 처리합니다.
    const { data, error } = await supabase.rpc('campus_record_contribution', {
      p_event_id: event.eventId,
      p_season_id: event.seasonId,
      p_school_id: event.schoolId,
      p_tile_id: event.tileId,
      p_kind: event.kind,
      p_session_id: event.sessionId,
    })

    if (error) return { accepted: false, points: 0, reason: 'not_ready' }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { accepted: boolean; points: number; captured: boolean; contested: boolean }
      | null
      | undefined

    if (!row) return { accepted: false, points: 0, reason: 'not_ready' }
    return {
      accepted: row.accepted,
      points: row.points ?? 0,
      captured: row.captured,
      contested: row.contested,
      tileId: event.tileId,
      reason: row.accepted ? undefined : 'duplicate_event',
    }
  }

  dispose(): void {
    this.listeners.clear()
    this.archivedCache = null
    void this.channel?.unsubscribe()
    this.channel = null
  }
}
