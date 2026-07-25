import { describe, expect, it } from 'vitest'
import { createSeasonMap, MAP_COLS, MAP_ROWS, MAP_TILE_COUNT, zoneAt } from './campusMap'
import {
  applyContributionToTile,
  captureProgress,
  CONTESTED_RATIO,
  countTilesBySchool,
  pickTargetTile,
  tileStatus,
} from './territory'
import type { CampusTile } from './types'

const NOW = Date.UTC(2026, 6, 20, 3, 0, 0)

function tile(overrides: Partial<CampusTile> = {}): CampusTile {
  return {
    id: 'season-1:0-0',
    seasonId: 'season-1',
    x: 0,
    y: 0,
    zone: 'lawn',
    ownerSchoolId: null,
    challengerSchoolId: null,
    defenseScore: 100,
    challengeScore: 0,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('가상 캠퍼스 지도', () => {
  it('12×8 = 96 타일이 만들어진다', () => {
    const tiles = createSeasonMap('season-1', NOW)
    expect(MAP_COLS).toBe(12)
    expect(MAP_ROWS).toBe(8)
    expect(tiles).toHaveLength(MAP_TILE_COUNT)
    expect(new Set(tiles.map((t) => t.id)).size).toBe(MAP_TILE_COUNT)
  })

  it('도서관·광장·강의동·잔디밭·카페 구역이 모두 존재한다', () => {
    const zones = new Set(createSeasonMap('season-1', NOW).map((t) => t.zone))
    expect([...zones].sort()).toEqual(['cafe', 'lawn', 'lecture', 'library', 'plaza'])
  })

  it('구역 배치는 좌표만으로 결정된다', () => {
    expect(zoneAt(0, 0)).toBe('lecture')
    expect(zoneAt(2, 3)).toBe('library')
    expect(zoneAt(6, 3)).toBe('plaza')
    expect(zoneAt(10, 3)).toBe('cafe')
    expect(zoneAt(6, 7)).toBe('lawn')
  })

  it('새 시즌 지도는 전부 중립 상태로 초기화된다', () => {
    const tiles = createSeasonMap('season-2', NOW)
    expect(tiles.every((t) => t.ownerSchoolId === null)).toBe(true)
    expect(tiles.every((t) => t.challengeScore === 0)).toBe(true)
  })
})

describe('타일 점령 계산', () => {
  it('중립 타일은 방어 점수를 넘어서면 점령된다', () => {
    const base = tile({ defenseScore: 100 })
    const partial = applyContributionToTile(base, 'snu', 100, NOW)
    expect(partial.captured).toBe(false)
    expect(partial.tile.challengerSchoolId).toBe('snu')

    const done = applyContributionToTile(partial.tile, 'snu', 20, NOW + 1)
    expect(done.captured).toBe(true)
    expect(done.tile.ownerSchoolId).toBe('snu')
    expect(done.tile.challengerSchoolId).toBeNull()
    expect(done.tile.challengeScore).toBe(0)
  })

  it('점령 시 넘친 점수가 새 owner 의 방어 점수로 이어진다', () => {
    const base = tile({ defenseScore: 100, challengeScore: 90, challengerSchoolId: 'snu' })
    const result = applyContributionToTile(base, 'snu', 50, NOW)
    expect(result.captured).toBe(true)
    // 140 - 100 = 40
    expect(result.tile.defenseScore).toBe(40)
  })

  it('내 학교가 owner 면 방어 점수가 올라간다', () => {
    const base = tile({ ownerSchoolId: 'korea', defenseScore: 200 })
    const result = applyContributionToTile(base, 'korea', 100, NOW)
    expect(result.captured).toBe(false)
    expect(result.tile.defenseScore).toBe(300)
    expect(result.events[0].kind).toBe('reinforced')
  })

  it('공격 점수가 방어의 80% 이상이면 경합 상태로 표시된다', () => {
    const base = tile({ ownerSchoolId: 'korea', defenseScore: 100 })
    const below = applyContributionToTile(base, 'snu', 70, NOW)
    expect(tileStatus(below.tile)).toBe('held')

    const at = applyContributionToTile(below.tile, 'snu', 10, NOW + 1)
    expect(captureProgress(at.tile)).toBeGreaterThanOrEqual(CONTESTED_RATIO)
    expect(tileStatus(at.tile)).toBe('contested')
    expect(at.events.some((e) => e.kind === 'contested')).toBe(true)
  })

  it('경합 이벤트는 상태가 처음 바뀔 때만 기록된다', () => {
    const base = tile({ ownerSchoolId: 'korea', defenseScore: 100, challengeScore: 85, challengerSchoolId: 'snu' })
    const again = applyContributionToTile(base, 'snu', 5, NOW)
    expect(again.events.some((e) => e.kind === 'contested')).toBe(false)
  })

  it('다른 학교의 공격은 기존 공격 점수를 깎고, 0 이하면 공격자가 교체된다', () => {
    const base = tile({
      ownerSchoolId: 'korea',
      challengerSchoolId: 'snu',
      challengeScore: 60,
      defenseScore: 200,
    })

    const pushed = applyContributionToTile(base, 'yonsei', 20, NOW)
    expect(pushed.tile.challengerSchoolId).toBe('snu')
    expect(pushed.tile.challengeScore).toBe(40)

    const swapped = applyContributionToTile(pushed.tile, 'yonsei', 100, NOW + 1)
    expect(swapped.tile.challengerSchoolId).toBe('yonsei')
    expect(swapped.tile.challengeScore).toBe(60)
  })

  it('0점 기여는 타일을 바꾸지 않는다', () => {
    const base = tile({ ownerSchoolId: 'korea' })
    const result = applyContributionToTile(base, 'snu', 0, NOW + 100)
    expect(result.tile).toBe(base)
    expect(result.events).toHaveLength(0)
  })

  it('학교별 점령 타일 수를 센다', () => {
    const tiles = [
      tile({ id: 'a', ownerSchoolId: 'snu' }),
      tile({ id: 'b', ownerSchoolId: 'snu' }),
      tile({ id: 'c', ownerSchoolId: 'korea' }),
      tile({ id: 'd' }),
    ]
    expect(countTilesBySchool(tiles)).toEqual({ snu: 2, korea: 1 })
  })
})

describe('기여 대상 타일 선택', () => {
  it('사용자가 고른 타일을 우선한다', () => {
    const tiles = [tile({ id: 'a' }), tile({ id: 'b' })]
    expect(pickTargetTile(tiles, 'snu', 'b')?.id).toBe('b')
  })

  it('고른 타일이 없으면 내가 이미 공격 중인 타일을 잇는다', () => {
    const tiles = [
      tile({ id: 'a', ownerSchoolId: 'korea', defenseScore: 100 }),
      tile({
        id: 'b',
        ownerSchoolId: 'korea',
        challengerSchoolId: 'snu',
        challengeScore: 80,
        defenseScore: 100,
      }),
    ]
    expect(pickTargetTile(tiles, 'snu')?.id).toBe('b')
  })

  it('내 학교 타일만 남으면 그중 하나라도 돌려준다', () => {
    const tiles = [tile({ id: 'a', ownerSchoolId: 'snu' })]
    expect(pickTargetTile(tiles, 'snu')?.id).toBe('a')
  })

  it('타일이 없으면 null', () => {
    expect(pickTargetTile([], 'snu')).toBeNull()
  })
})
