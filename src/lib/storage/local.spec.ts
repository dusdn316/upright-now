import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocal, loadLocal, saveLocal } from './local'

describe('버전 포함 localStorage', () => {
  beforeEach(() => localStorage.clear())

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
