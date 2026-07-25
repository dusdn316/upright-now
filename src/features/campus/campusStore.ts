import { create } from 'zustand'
import { isRoomConfigured } from '@/lib/supabase/client'
import { parseFlag } from '@/lib/feature-flags/flags'
import { MockCampusRepository, type CampusIdentity } from './mockRepository'
import { SupabaseCampusRepository } from './supabaseRepository'
import { getCampusMemberId } from './identity'
import { useCampusThemeStore } from './campusThemeStore'
import { rankStandings } from './contribution'
import { seasonAt } from './season'
import { createSeasonMap } from './campusMap'
import type { CampusRepository } from './repository'
import type { CampusSnapshot } from './types'

/**
 * 캠퍼스 영토전 화면 상태.
 *
 * 저장소는 `CampusRepository` 하나로 추상화되어 있어, mock → Supabase 교체 시
 * 화면 코드를 고치지 않습니다. 기본값은 mock 입니다.
 * Supabase 를 쓰려면 migration 을 적용한 프로젝트에서
 * `VITE_ENABLE_CAMPUS_SUPABASE=true` 를 명시적으로 켜야 합니다.
 */
export type CampusStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CampusStoreState {
  status: CampusStatus
  source: 'mock' | 'supabase' | null
  snapshot: CampusSnapshot | null
  /** 방금 점령된 타일 — 색상 변화 애니메이션 트리거 */
  flashTileIds: string[]
  errorMessage: string | null
}

const emptySnapshot = (now: number): CampusSnapshot => {
  const season = seasonAt(now)
  return {
    season,
    tiles: createSeasonMap(season.id, now),
    standings: [],
    tileEvents: [],
    myContribution: 0,
    archived: [],
  }
}

export const useCampusStore = create<CampusStoreState>(() => ({
  status: 'idle',
  source: null,
  snapshot: null,
  flashTileIds: [],
  errorMessage: null,
}))

let repository: CampusRepository | null = null
let unsubscribe: (() => void) | null = null
let flashTimer: number | null = null

function identity(): CampusIdentity {
  return {
    memberId: getCampusMemberId(),
    schoolId: useCampusThemeStore.getState().schoolId,
  }
}

function useSupabaseRepository(): boolean {
  return (
    parseFlag(import.meta.env.VITE_ENABLE_CAMPUS_SUPABASE, false) && isRoomConfigured()
  )
}

function createRepository(): CampusRepository {
  return useSupabaseRepository()
    ? new SupabaseCampusRepository()
    : new MockCampusRepository(identity)
}

/** 점령된 타일을 잠깐 강조합니다. (색상 변화 애니메이션) */
function flash(tileIds: string[]): void {
  if (tileIds.length === 0) return
  useCampusStore.setState((s) => ({
    flashTileIds: [...new Set([...s.flashTileIds, ...tileIds])],
  }))
  if (flashTimer) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    useCampusStore.setState({ flashTileIds: [] })
    flashTimer = null
  }, 1200)
}

function applySnapshot(next: CampusSnapshot): void {
  const previous = useCampusStore.getState().snapshot
  const changed: string[] = []
  if (previous && previous.season.id === next.season.id) {
    const before = new Map(previous.tiles.map((t) => [t.id, t.ownerSchoolId]))
    for (const tile of next.tiles) {
      if (before.has(tile.id) && before.get(tile.id) !== tile.ownerSchoolId) {
        changed.push(tile.id)
      }
    }
  }
  useCampusStore.setState({ snapshot: next, status: 'ready', errorMessage: null })
  flash(changed)
}

/** 화면 진입 시 호출합니다. 여러 번 불려도 저장소는 하나만 만듭니다. */
export async function initCampus(): Promise<void> {
  if (repository) {
    // 학교가 바뀐 뒤 다시 들어오면 내 기여도가 새 학교 기준으로 갱신되어야 합니다.
    try {
      applySnapshot(await repository.load())
    } catch {
      // 이미 화면에 그려진 스냅샷을 유지합니다.
    }
    return
  }

  useCampusStore.setState({ status: 'loading', errorMessage: null })
  const repo = createRepository()
  repository = repo
  useCampusStore.setState({ source: repo.kind })

  unsubscribe = repo.subscribe(applySnapshot)

  try {
    applySnapshot(await repo.load())
  } catch {
    // Supabase 실패 시 mock 으로 내려앉아 화면은 계속 동작합니다.
    repo.dispose()
    unsubscribe?.()
    const fallback = new MockCampusRepository(identity)
    repository = fallback
    useCampusStore.setState({ source: 'mock' })
    unsubscribe = fallback.subscribe(applySnapshot)
    try {
      applySnapshot(await fallback.load())
    } catch {
      useCampusStore.setState({
        status: 'error',
        snapshot: emptySnapshot(Date.now()),
        errorMessage: '캠퍼스 데이터를 불러오지 못했어요.',
      })
    }
  }
}

export function getCampusRepository(): CampusRepository | null {
  return repository
}

export function disposeCampus(): void {
  unsubscribe?.()
  unsubscribe = null
  repository?.dispose()
  repository = null
  if (flashTimer) {
    window.clearTimeout(flashTimer)
    flashTimer = null
  }
  useCampusStore.setState({
    status: 'idle',
    source: null,
    snapshot: null,
    flashTileIds: [],
    errorMessage: null,
  })
}

/* -------------------------------- 선택자 --------------------------------- */

export function selectRankedStandings(state: CampusStoreState) {
  return rankStandings(state.snapshot?.standings ?? [])
}

export function selectMyTileCount(state: CampusStoreState, schoolId: string | null): number {
  if (!schoolId || !state.snapshot) return 0
  return state.snapshot.tiles.filter((t) => t.ownerSchoolId === schoolId).length
}
