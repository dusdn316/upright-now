import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearLocal,
  isDemoContamination,
  loadLocal,
  resetMigrationForTest,
  saveLocal,
} from './local'

describe('버전 포함 localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMigrationForTest()
  })

  it('저장한 값을 그대로 불러온다', () => {
    saveLocal('user', { nickname: '수현', xp: 120 })
    expect(loadLocal('user', { nickname: '', xp: 0 })).toEqual({
      nickname: '수현',
      xp: 120,
    })
  })

  it('값이 없으면 기본값을 돌려준다', () => {
    expect(loadLocal('missing', { a: 1 })).toEqual({ a: 1 })
  })

  it('스키마 버전이 다르면 기본값으로 폴백한다', () => {
    localStorage.setItem('upright-now:user', JSON.stringify({ v: 999, data: { x: 1 } }))
    expect(loadLocal('user', { fallback: true })).toEqual({ fallback: true })
  })

  it('clearLocal 은 네임스페이스 키만 지운다', () => {
    saveLocal('user', { a: 1 })
    localStorage.setItem('other-app', 'keep')
    clearLocal()
    expect(loadLocal('user', null)).toBeNull()
    expect(localStorage.getItem('other-app')).toBe('keep')
  })
})

describe('v1 → v2 마이그레이션 (긴급 안정화 F)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMigrationForTest()
  })

  function seedV1(name: string, data: unknown) {
    localStorage.setItem(`upright-now:${name}`, JSON.stringify({ v: 1, data }))
  }

  it('데모 시드가 남은 progression 은 0 으로 초기화한다', () => {
    seedV1('progression', {
      xp: 700,
      points: 240,
      attendance: [],
      completedSessions: 0,
      inventory: [],
      equipped: {},
      shopUnlocked: false,
    })

    const loaded = loadLocal<{ xp: number; points: number }>('progression', {
      xp: -1,
      points: -1,
    })
    expect(loaded.xp).toBe(0)
    expect(loaded.points).toBe(0)
  })

  it('실제로 획득한 progression 은 그대로 유지한다', () => {
    seedV1('progression', {
      xp: 130,
      points: 103,
      attendance: ['2026-07-24'],
      completedSessions: 1,
      inventory: [],
      equipped: {},
      shopUnlocked: true,
    })

    const loaded = loadLocal<{ xp: number; completedSessions: number }>(
      'progression',
      { xp: -1, completedSessions: -1 },
    )
    expect(loaded.xp).toBe(130)
    expect(loaded.completedSessions).toBe(1)
  })

  it('v1 캘리브레이션 기준은 폐기되고 hasCalibration 도 내려간다', () => {
    seedV1('calibration', {
      profile: { id: 'old', baseline: {}, variance: {} },
      sensitivity: 'gentle',
    })
    seedV1('user', {
      nickname: '수현',
      hasOnboarded: true,
      profileId: 'library',
      hasCalibration: true,
      soundEnabled: false,
    })

    const cal = loadLocal<{ profile: unknown; sensitivity: string }>(
      'calibration',
      { profile: 'x', sensitivity: '' },
    )
    expect(cal.profile).toBeNull()
    expect(cal.sensitivity).toBe('gentle')

    const user = loadLocal<{ nickname: string; hasCalibration: boolean }>(
      'user',
      { nickname: '', hasCalibration: true },
    )
    expect(user.nickname).toBe('수현')
    expect(user.hasCalibration).toBe(false)
  })

  it('isDemoContamination 은 획득 이력이 있으면 false 다', () => {
    expect(
      isDemoContamination({
        xp: 700,
        points: 240,
        attendance: [],
        completedSessions: 0,
      }),
    ).toBe(true)
    expect(
      isDemoContamination({
        xp: 700,
        points: 240,
        attendance: ['2026-07-20'],
        completedSessions: 0,
      }),
    ).toBe(false)
    expect(
      isDemoContamination({
        xp: 20,
        points: 20,
        attendance: [],
        completedSessions: 0,
      }),
    ).toBe(true)
  })
})
