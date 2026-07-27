import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 기타 학교 "명시 저장" 흐름.
 *
 * 핵심 계약:
 * - 라디오 선택(기타)만으로는 서버 동기화가 절대 일어나지 않는다.
 * - [학교 정보 저장하고 선택] = 이름·짧은 이름·색이 유효할 때만 서버 upsert→select.
 * - 서버 실패(change_cooldown 등)면 이전 학교로 되돌린다.
 * - 구버전 schoolId='custom' 저장분은 이름 기반 stable key 로 migration 된다.
 */

const syncSchoolSelection = vi.fn<() => Promise<string>>()

vi.mock('./campusStore', () => ({
  syncSchoolSelection: (...args: unknown[]) =>
    syncSchoolSelection(...(args as [])),
}))

const {
  useCampusThemeStore,
  customSchoolStableKey,
  sanitizeSchoolName,
} = await import('./campusThemeStore')

const flushAsync = () => new Promise((r) => setTimeout(r, 0))

describe('기타 학교 명시 저장', () => {
  beforeEach(() => {
    localStorage.clear()
    useCampusThemeStore.getState().reset()
    useCampusThemeStore.getState().clearSyncNotice()
    syncSchoolSelection.mockReset()
    syncSchoolSelection.mockResolvedValue('selected')
  })

  afterEach(() => {
    useCampusThemeStore.getState().reset()
  })

  it("selectSchool('custom') 은 서버 동기화를 호출하지 않는다", async () => {
    useCampusThemeStore.getState().selectSchool('custom', Date.now())
    await flushAsync()
    expect(syncSchoolSelection).not.toHaveBeenCalled()
  })

  it('selectSchool(stable key) 도 서버 동기화를 호출하지 않는다 (저장 버튼 전용)', async () => {
    useCampusThemeStore.getState().selectSchool('custom-abcd1234', Date.now())
    await flushAsync()
    expect(syncSchoolSelection).not.toHaveBeenCalled()
  })

  it('이름이 비었거나 1자면 저장이 거부되고 서버 호출이 없다', async () => {
    const s = useCampusThemeStore.getState()
    s.setCustomSchoolName('한', '한')
    const decision = s.saveCustomSchool(Date.now())
    await flushAsync()
    expect(decision.allowed).toBe(false)
    expect(syncSchoolSelection).not.toHaveBeenCalled()
    expect(useCampusThemeStore.getState().schoolId).toBeNull()
    expect(useCampusThemeStore.getState().syncStatus).toBe('error')
  })

  it('세 값이 유효하면 stable key 로 확정하고 서버 upsert→select 를 1회 호출한다', async () => {
    const s = useCampusThemeStore.getState()
    s.setCustomSchoolName('한밭대학교', '한밭대')
    s.setCustomColor('#4A5CA8')
    const decision = s.saveCustomSchool(Date.now())
    expect(decision.allowed).toBe(true)
    const key = customSchoolStableKey('한밭대학교')
    expect(key).toMatch(/^custom-[0-9a-f]{1,8}$/)
    expect(useCampusThemeStore.getState().schoolId).toBe(key)
    await flushAsync()
    expect(syncSchoolSelection).toHaveBeenCalledTimes(1)
    expect(syncSchoolSelection).toHaveBeenCalledWith(key)
    expect(useCampusThemeStore.getState().syncStatus).toBe('ok')
  })

  it('같은 이름은 같은 stable key — 타 사용자 학교(existing)와 자연 합류한다', () => {
    expect(customSchoolStableKey('한밭대학교')).toBe(customSchoolStableKey('한밭대학교'))
    expect(customSchoolStableKey('  한밭대학교  ')).toBe(customSchoolStableKey('한밭대학교'))
    expect(customSchoolStableKey('다른대학교')).not.toBe(customSchoolStableKey('한밭대학교'))
  })

  it('서버 change_cooldown 이면 이전 학교로 되돌린다', async () => {
    const s = useCampusThemeStore.getState()
    s.selectSchool('snu', Date.now())
    // 'snu' 선택의 서버 동기화(성공)를 먼저 흘려보낸 뒤 쿨다운 응답으로 바꿉니다.
    await flushAsync()
    syncSchoolSelection.mockResolvedValue('change_cooldown')
    // 쿨다운 검사는 서버가 하므로, 로컬 검사 통과 시나리오를 만들기 위해
    // 7일 뒤 시각으로 저장을 시도합니다.
    const later = Date.now() + 8 * 24 * 60 * 60 * 1000
    useCampusThemeStore.getState().setCustomSchoolName('한밭대학교', '한밭대')
    useCampusThemeStore.getState().setCustomColor('#4A5CA8')
    useCampusThemeStore.getState().saveCustomSchool(later)
    await flushAsync()
    expect(useCampusThemeStore.getState().schoolId).toBe('snu')
    expect(useCampusThemeStore.getState().syncStatus).toBe('error')
    expect(useCampusThemeStore.getState().syncNotice).toContain('7일')
  })

  it('sanitizeSchoolName 은 제어문자·초과 길이를 제거한다', () => {
    expect(sanitizeSchoolName('  한밭대학교  ', 30)).toBe('한밭대학교')
    expect(sanitizeSchoolName('가'.repeat(40), 30)).toHaveLength(30)
  })
})

describe('구버전 schoolId=custom migration', () => {
  it('이름이 유효하면 로드 시 stable key 로 바뀐다', async () => {
    vi.resetModules()
    localStorage.setItem(
      'upright-now:campus',
      JSON.stringify({
        v: 2,
        data: {
          schoolId: 'custom',
          customColor: '#4A5CA8',
          customSchoolName: '한밭대학교',
          customSchoolShortName: '한밭대',
          lastChangedAt: null,
          lastChangedSeasonId: null,
          changesInSeason: 0,
          targetTileId: null,
        },
      }),
    )
    const fresh = await import('./campusThemeStore')
    const key = fresh.customSchoolStableKey('한밭대학교')
    expect(fresh.useCampusThemeStore.getState().schoolId).toBe(key)
    // 표시 이름은 그대로 유지된다 (무손실)
    expect(fresh.useCampusThemeStore.getState().customSchoolName).toBe('한밭대학교')
  })
})
