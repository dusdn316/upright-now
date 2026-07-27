import type { CampusTile, CampusTileEvent, CampusTileStatus } from './types'

/**
 * 영토 점령 계산 — 순수 함수.
 *
 * 규칙 (docs/CAMPUS_TERRITORY_SPEC.md §4)
 * - 내 학교가 owner 면 방어 점수가 올라갑니다.
 * - 다른 학교가 owner 면 공격 점수가 올라갑니다.
 * - 공격 점수가 방어 점수를 넘어서면 점령됩니다.
 * - 점령 직전 80% 이상이면 지도에서 경합 상태로 표시합니다.
 */
export const CONTESTED_RATIO = 0.8

export function captureProgress(tile: CampusTile): number {
  const defense = Math.max(tile.defenseScore, 1)
  return Math.max(0, Math.min(1, tile.challengeScore / defense))
}

export function tileStatus(tile: CampusTile): CampusTileStatus {
  if (tile.challengerSchoolId && captureProgress(tile) >= CONTESTED_RATIO) {
    return 'contested'
  }
  return tile.ownerSchoolId ? 'held' : 'neutral'
}

export interface TileContributionResult {
  tile: CampusTile
  captured: boolean
  contested: boolean
  events: CampusTileEvent[]
}

/**
 * 같은 밀리초에 같은 타일·같은 종류의 이벤트가 두 번 생겨도
 * 로그 목록의 키가 겹치지 않도록 단조 증가 카운터를 함께 씁니다.
 */
let eventSeq = 0

function makeEvent(
  tile: CampusTile,
  kind: CampusTileEvent['kind'],
  fromSchoolId: string | null,
  toSchoolId: string | null,
  at: number,
  seq: number,
): CampusTileEvent {
  eventSeq += 1
  return {
    id: `${tile.id}:${kind}:${at}:${seq}:${eventSeq}`,
    seasonId: tile.seasonId,
    tileId: tile.id,
    kind,
    fromSchoolId,
    toSchoolId,
    at,
  }
}

/**
 * 타일 한 칸에 기여 점수를 적용합니다.
 *
 * challenger 슬롯은 한 학교만 차지합니다. 다른 학교가 이미 공격 중이면
 * 내 점수가 그 공격 점수를 깎고, 0 이하로 내려가면 내 학교가 공격자가 됩니다.
 */
export function applyContributionToTile(
  tile: CampusTile,
  schoolId: string,
  points: number,
  at: number,
): TileContributionResult {
  if (points <= 0) {
    return { tile, captured: false, contested: tileStatus(tile) === 'contested', events: [] }
  }

  const wasContested = tileStatus(tile) === 'contested'
  const events: CampusTileEvent[] = []
  let next: CampusTile = { ...tile, updatedAt: at }

  if (tile.ownerSchoolId === schoolId) {
    // 방어 보강
    next.defenseScore = tile.defenseScore + points
    events.push(makeEvent(tile, 'reinforced', schoolId, schoolId, at, 0))
  } else if (!tile.challengerSchoolId || tile.challengerSchoolId === schoolId) {
    next.challengerSchoolId = schoolId
    next.challengeScore = tile.challengeScore + points
  } else {
    // 다른 학교가 공격 중 — 내 점수가 그 공격을 밀어냅니다.
    const remaining = tile.challengeScore - points
    if (remaining > 0) {
      next.challengeScore = remaining
    } else {
      next.challengerSchoolId = schoolId
      next.challengeScore = -remaining
    }
  }

  let captured = false
  if (next.challengerSchoolId && next.challengeScore > next.defenseScore) {
    const from = next.ownerSchoolId
    const to = next.challengerSchoolId
    // 넘친 점수는 새 owner 의 방어 점수로 이어집니다.
    const carry = next.challengeScore - next.defenseScore
    next = {
      ...next,
      ownerSchoolId: to,
      challengerSchoolId: null,
      defenseScore: Math.max(1, carry),
      challengeScore: 0,
    }
    captured = true
    events.push(makeEvent(tile, 'captured', from, to, at, 1))
  }

  const nowContested = tileStatus(next) === 'contested'
  if (!captured && nowContested && !wasContested) {
    events.push(makeEvent(tile, 'contested', next.ownerSchoolId, next.challengerSchoolId, at, 2))
  }

  return { tile: next, captured, contested: nowContested, events }
}

/** 학교별 점령 타일 수 */
export function countTilesBySchool(tiles: CampusTile[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tile of tiles) {
    if (!tile.ownerSchoolId) continue
    counts[tile.ownerSchoolId] = (counts[tile.ownerSchoolId] ?? 0) + 1
  }
  return counts
}

/**
 * 기여를 넣을 타일을 고릅니다.
 * 1) 사용자가 고른 타일 2) 경합 중인 내 공격 타일 3) 가장 약한 남의/중립 타일
 */
export function pickTargetTile(
  tiles: CampusTile[],
  schoolId: string,
  preferredTileId?: string | null,
): CampusTile | null {
  if (tiles.length === 0) return null

  if (preferredTileId) {
    const preferred = tiles.find((t) => t.id === preferredTileId)
    if (preferred) return preferred
  }

  const myChallenges = tiles
    .filter((t) => t.challengerSchoolId === schoolId && t.ownerSchoolId !== schoolId)
    .sort((a, b) => captureProgress(b) - captureProgress(a))
  if (myChallenges.length > 0) return myChallenges[0]

  const openings = tiles
    .filter((t) => t.ownerSchoolId !== schoolId)
    .sort(
      (a, b) =>
        a.defenseScore - a.challengeScore - (b.defenseScore - b.challengeScore) ||
        a.id.localeCompare(b.id),
    )
  return openings[0] ?? tiles[0]
}
