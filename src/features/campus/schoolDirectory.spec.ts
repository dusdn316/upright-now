import { describe, expect, it } from 'vitest'
import { resolveSchoolIdentity } from './schoolDirectory'

/**
 * 학교 표시 정보 단일 해석기 — 해석 순서와 안전 폴백.
 * stable key·"직접 설정" 이 사용자에게 노출되지 않아야 합니다.
 */
const DIRECTORY = {
  'custom-abc123': {
    id: 'custom-abc123',
    displayName: '한국대학교',
    shortName: '한국대',
    color: '#4A5CA8',
    isCustom: true,
  },
}

const LOCAL = {
  schoolId: 'custom-abc123',
  customSchoolName: '한국대학교',
  customSchoolShortName: '한국대',
  customColor: '#4A5CA8',
}

describe('resolveSchoolIdentity', () => {
  it('1순위 — 서버 디렉터리 (다른 사용자의 커스텀 학교도 이름이 보인다)', () => {
    const id = resolveSchoolIdentity('custom-abc123', DIRECTORY)
    expect(id?.displayName).toBe('한국대학교')
    expect(id?.shortName).toBe('한국대')
    expect(id?.color).toBe('#4A5CA8')
    expect(id?.resolved).toBe('directory')
  })

  it('2순위 — 프리셋 학교', () => {
    const id = resolveSchoolIdentity('snu', {})
    expect(id?.displayName).toBe('서울대학교')
    expect(id?.resolved).toBe('preset')
  })

  it('3순위 — 내 로컬 입력 (서버 반영 전 잠깐)', () => {
    const id = resolveSchoolIdentity('custom-abc123', {}, LOCAL)
    expect(id?.displayName).toBe('한국대학교')
    expect(id?.resolved).toBe('local')
  })

  it('4순위 — 알 수 없는 학교 폴백 (stable key 를 노출하지 않는다)', () => {
    const id = resolveSchoolIdentity('custom-deadbeef', {})
    expect(id?.displayName).toBe('알 수 없는 학교')
    expect(id?.shortName).toBe('미확인')
    expect(id?.displayName).not.toContain('custom-')
    expect(id?.shortName).not.toContain('custom-')
    expect(id?.resolved).toBe('unknown')
  })

  it('타인의 커스텀 학교는 로컬 입력의 영향을 받지 않는다', () => {
    const other = resolveSchoolIdentity('custom-ffff00', {}, LOCAL)
    expect(other?.resolved).toBe('unknown')
  })

  it('null 학교는 null', () => {
    expect(resolveSchoolIdentity(null, DIRECTORY)).toBeNull()
  })
})
