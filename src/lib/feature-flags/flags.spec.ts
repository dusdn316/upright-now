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

  it('운영 빌드처럼 QA Lab 을 끌 수 있다', () => {
    const flags = readFeatureFlags({
      VITE_ENABLE_QA_LAB: 'false',
    } as ImportMetaEnv)

    expect(flags.qaLab).toBe(false)
  })
})
