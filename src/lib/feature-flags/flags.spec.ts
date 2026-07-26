import { describe, expect, it } from 'vitest'
import { parseFlag, readFeatureFlags } from './flags'

describe('기능 플래그', () => {
  it('문자열 "true" 와 "1" 만 켜짐으로 읽는다', () => {
    expect(parseFlag('true')).toBe(true)
    expect(parseFlag('1')).toBe(true)
    expect(parseFlag('false')).toBe(false)
    expect(parseFlag('')).toBe(false)
    expect(parseFlag(undefined, true)).toBe(true)
  })

  it('Phase 1 기본값: Supabase·PIP 는 꺼져 있고 QA Lab 만 켤 수 있다', () => {
    const flags = readFeatureFlags({
      VITE_ENABLE_QA_LAB: 'true',
    } as ImportMetaEnv)

    expect(flags.realtimeRoom).toBe(false)
    expect(flags.pictureInPicture).toBe(false)
    expect(flags.qaLab).toBe(true)
  })

  it('캠퍼스 플래그 기본값은 false 다', () => {
    const flags = readFeatureFlags({} as ImportMetaEnv)

    expect(flags.campusTheme).toBe(false)
    expect(flags.campusTerritory).toBe(false)
    expect(flags.campusSchoolPicker).toBe(false)
  })

  it('캠퍼스 플래그 중 하나만 켜도 학교 선택은 노출된다', () => {
    const themeOnly = readFeatureFlags({
      VITE_ENABLE_CAMPUS_THEME: 'true',
    } as ImportMetaEnv)
    expect(themeOnly.campusTheme).toBe(true)
    expect(themeOnly.campusTerritory).toBe(false)
    expect(themeOnly.campusSchoolPicker).toBe(true)

    const territoryOnly = readFeatureFlags({
      VITE_ENABLE_CAMPUS_TERRITORY: '1',
    } as ImportMetaEnv)
    expect(territoryOnly.campusTheme).toBe(false)
    expect(territoryOnly.campusTerritory).toBe(true)
    expect(territoryOnly.campusSchoolPicker).toBe(true)
  })

  it('운영 빌드처럼 QA Lab 을 끌 수 있다', () => {
    const flags = readFeatureFlags({
      VITE_ENABLE_QA_LAB: 'false',
    } as ImportMetaEnv)

    expect(flags.qaLab).toBe(false)
  })
})
