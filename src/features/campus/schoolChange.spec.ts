import { describe, expect, it } from 'vitest'
import {
  applySchoolChange,
  canChangeSchool,
  SCHOOL_CHANGE_COOLDOWN_MS,
  type SchoolChangeHistory,
} from './schoolChange'

const NOW = Date.UTC(2026, 6, 20, 3, 0, 0)
const SEASON = { seasonId: 'season-1', seasonEndsAt: NOW + 5 * 24 * 60 * 60 * 1000 }

function history(overrides: Partial<SchoolChangeHistory> = {}): SchoolChangeHistory {
  return {
    schoolId: null,
    lastChangedAt: null,
    lastChangedSeasonId: null,
    changesInSeason: 0,
    ...overrides,
  }
}

describe('학교 첫 선택', () => {
  it('처음 고르는 것은 변경으로 세지 않는다', () => {
    const decision = canChangeSchool({ history: history(), ...SEASON, now: NOW }, 'snu')
    expect(decision.allowed).toBe(true)
    expect(decision.firstPick).toBe(true)

    const next = applySchoolChange(history(), 'snu', SEASON.seasonId, NOW)
    expect(next.schoolId).toBe('snu')
    expect(next.changesInSeason).toBe(0)
    expect(next.lastChangedAt).toBeNull()
  })

  it('첫 선택 직후에도 한 번은 바꿀 수 있다', () => {
    const afterFirst = applySchoolChange(history(), 'snu', SEASON.seasonId, NOW)
    const decision = canChangeSchool(
      { history: afterFirst, ...SEASON, now: NOW + 1000 },
      'korea',
    )
    expect(decision.allowed).toBe(true)
  })
})

describe('학교 변경 제한', () => {
  const afterOneChange = applySchoolChange(
    applySchoolChange(history(), 'snu', SEASON.seasonId, NOW),
    'korea',
    SEASON.seasonId,
    NOW,
  )

  it('시즌 중 두 번째 변경은 막힌다', () => {
    expect(afterOneChange.changesInSeason).toBe(1)
    const decision = canChangeSchool(
      { history: afterOneChange, ...SEASON, now: NOW + 1000 },
      'yonsei',
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('season_limit')
    expect(decision.nextAllowedAt).toBeGreaterThanOrEqual(SEASON.seasonEndsAt)
  })

  it('시즌이 넘어가도 7일이 지나지 않으면 막힌다', () => {
    const decision = canChangeSchool(
      {
        history: afterOneChange,
        seasonId: 'season-2',
        seasonEndsAt: NOW + 20 * 24 * 60 * 60 * 1000,
        now: NOW + 3 * 24 * 60 * 60 * 1000,
      },
      'yonsei',
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('cooldown')
    expect(decision.nextAllowedAt).toBe(NOW + SCHOOL_CHANGE_COOLDOWN_MS)
  })

  it('새 시즌이고 7일이 지났으면 다시 바꿀 수 있다', () => {
    const decision = canChangeSchool(
      {
        history: afterOneChange,
        seasonId: 'season-2',
        seasonEndsAt: NOW + 30 * 24 * 60 * 60 * 1000,
        now: NOW + SCHOOL_CHANGE_COOLDOWN_MS + 1,
      },
      'yonsei',
    )
    expect(decision.allowed).toBe(true)
  })

  it('같은 학교를 다시 고르는 것은 변경이 아니다', () => {
    const decision = canChangeSchool(
      { history: afterOneChange, ...SEASON, now: NOW + 1000 },
      'korea',
    )
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('same_school')
  })

  it('시즌이 바뀌면 그 시즌의 변경 횟수는 다시 0부터 센다', () => {
    const next = applySchoolChange(
      afterOneChange,
      'yonsei',
      'season-2',
      NOW + SCHOOL_CHANGE_COOLDOWN_MS + 1,
    )
    expect(next.changesInSeason).toBe(1)
    expect(next.lastChangedSeasonId).toBe('season-2')
  })
})
