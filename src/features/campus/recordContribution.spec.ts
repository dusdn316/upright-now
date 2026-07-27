import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 캠퍼스 영토전 플래그가 켜진 상태의 기여 기록 경로.
 * (플래그 OFF 회귀는 recordContribution.off.spec.ts 에서 확인합니다)
 */
const ON = {
  camera: false,
  friendRoom: false,
  realtimeRoom: false,
  pictureInPicture: false,
  qaLab: false,
  optionalSlouchCalibration: false,
  campusTheme: true,
  campusTerritory: true,
  campusSchoolPicker: true,
}

vi.mock('@/lib/feature-flags/flags', () => ({
  featureFlags: ON,
  parseFlag: () => false,
  readFeatureFlags: () => ON,
}))

const { recordCampusContribution, resetContributionLedgerForTest } = await import(
  './recordContribution'
)
const { useCampusThemeStore } = await import('./campusThemeStore')
const { disposeCampus, useCampusStore } = await import('./campusStore')
const { resetMockCampusForTest } = await import('./mockRepository')
const { useDemoStore } = await import('@/features/demo/demoMode')
const { CONTRIBUTION_POINTS } = await import('./contribution')
const { resetAllData } = await import('@/features/settings/dataReset')

describe('기여 기록 (플래그 ON)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMockCampusForTest()
    resetContributionLedgerForTest()
    disposeCampus()
    useCampusThemeStore.getState().reset()
    useDemoStore.setState({ isDemo: false })
  })

  afterEach(() => {
    disposeCampus()
    resetMockCampusForTest()
    localStorage.clear()
  })

  it('학교를 고르지 않으면 기여가 기록되지 않는다', async () => {
    const result = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e1',
      sessionId: 's1',
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('no_school')
  })

  it('데모 모드에서는 기여가 기록되지 않는다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    useDemoStore.setState({ isDemo: true })

    const result = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e-demo',
      sessionId: 's1',
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('demo_or_qa')
  })

  it('학교를 고르면 정상 완료 세션이 100점으로 기록된다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')

    const result = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e-ok',
      sessionId: 's1',
    })

    expect(result.accepted).toBe(true)
    expect(result.points).toBe(CONTRIBUTION_POINTS.session_completed)
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(100)
  })

  it('같은 eventId 는 다시 기록되지 않는다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')

    await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e-dup',
      sessionId: 's1',
    })
    const again = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e-dup',
      sessionId: 's1',
    })

    expect(again.accepted).toBe(false)
    expect(again.reason).toBe('duplicate_event')
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(100)
  })

  it('같은 세션의 완주는 eventId 가 달라도 한 번만 기록된다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')

    await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e-a',
      sessionId: 'same',
    })
    const again = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'e-b',
      sessionId: 'same',
    })

    expect(again.reason).toBe('duplicate_session')
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(100)
  })

  it('친구 세션 완주는 정상 완료와 별개로 50점이 더해진다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')

    await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'room-session',
      sessionId: 'room-1',
    })
    const friend = await recordCampusContribution({
      kind: 'friend_session_completed',
      eventId: 'room-friend',
      sessionId: 'room-1',
    })

    expect(friend.accepted).toBe(true)
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(150)
  })

  it('학교를 바꾸면 이전 학교 기여도가 옮겨지지 않는다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'before-change',
      sessionId: 's1',
    })
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(100)

    // 첫 선택은 변경으로 세지 않으므로 한 번은 바로 바꿀 수 있습니다.
    const decision = useCampusThemeStore.getState().selectSchool('korea')
    expect(decision.allowed).toBe(true)

    await recordCampusContribution({
      kind: 'stretch_completed',
      eventId: 'after-change',
      sessionId: null,
    })

    // 고려대 기준으로 20점만 보입니다. (서울대의 100점은 서울대에 남습니다)
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(
      CONTRIBUTION_POINTS.stretch_completed,
    )
  })

  it('전체 로컬 데이터 초기화가 학교 선택·기여 원장·익명 식별자를 지운다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'before-reset',
      sessionId: 's1',
    })
    expect(useCampusStore.getState().snapshot?.myContribution).toBe(100)

    resetAllData()

    expect(useCampusThemeStore.getState().schoolId).toBeNull()
    expect(useCampusStore.getState().snapshot).toBeNull()
    expect(localStorage.getItem('upright-now:campus')).toBeNull()
    expect(localStorage.getItem('upright-now:campus-ledger')).toBeNull()
    expect(localStorage.getItem('upright-now:campus-member')).toBeNull()

    /*
      로컬 원장을 지워도 저장소(서버 역할)가 eventId 를 기억하므로
      같은 이벤트를 다시 보내 기여도를 두 번 쌓을 수 없습니다.
    */
    useCampusThemeStore.getState().selectSchool('snu')
    const again = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'before-reset',
      sessionId: 's1',
    })
    expect(again.accepted).toBe(false)
    expect(again.reason).toBe('duplicate_event')
  })

  it('기여 대상 타일을 고르면 그 타일에 반영된다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    // 저장소를 먼저 준비해 타일 목록을 얻습니다.
    await recordCampusContribution({
      kind: 'stretch_completed',
      eventId: 'warmup',
      sessionId: null,
    })
    const tiles = useCampusStore.getState().snapshot!.tiles
    const target = tiles.find((t) => t.ownerSchoolId !== 'snu' && !t.challengerSchoolId)!
    useCampusThemeStore.getState().setTargetTile(target.id)

    const result = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'targeted',
      sessionId: 'sx',
    })

    expect(result.accepted).toBe(true)
    expect(result.tileId).toBe(target.id)
  })
})
