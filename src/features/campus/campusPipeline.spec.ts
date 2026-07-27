import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * RC2 기여 파이프라인 — supabase 경로의 outbox·권위값 즉시 반영·영구/일시
 * 거절 구분을 검증합니다. (서버는 fake repository 로 대체)
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

const h = vi.hoisted(() => {
  const submit = vi.fn()
  const applied: unknown[] = []
  return {
    submit,
    applied,
    repo: { kind: 'supabase' as const, submitContribution: submit },
    snapshot: null as unknown,
  }
})

vi.mock('./campusStore', () => ({
  getCampusRepository: () => h.repo,
  initCampus: async () => {},
  applyAuthoritativeResult: (r: unknown) => {
    h.applied.push(r)
  },
  syncPendingCount: () => {},
  useCampusStore: {
    getState: () => ({ snapshot: h.snapshot }),
    setState: () => {},
  },
}))

const { recordCampusContribution } = await import('./recordContribution')
const { outboxItems, resetOutboxForTest, enqueueOutbox } = await import('./outbox')
const { flushCampusOutbox } = await import('./outboxFlush')
const { useCampusThemeStore } = await import('./campusThemeStore')
const { useDemoStore } = await import('@/features/demo/demoMode')
const { createSeasonMap } = await import('./campusMap')
const { seasonAt } = await import('./season')

function makeSnapshot() {
  const season = seasonAt(Date.now())
  return {
    season,
    tiles: createSeasonMap(season.id, Date.now()),
    standings: [],
    tileEvents: [],
    myContribution: 0,
    archived: [],
  }
}

describe('supabase 기여 파이프라인 — outbox·권위값', () => {
  beforeEach(() => {
    localStorage.clear()
    resetOutboxForTest()
    h.submit.mockReset()
    h.applied.length = 0
    h.snapshot = makeSnapshot()
    useDemoStore.setState({ isDemo: false })
    useCampusThemeStore.setState({ schoolId: 'snu' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('수락되면 outbox 에서 제거되고 권위값이 즉시 반영된다', async () => {
    h.submit.mockResolvedValueOnce({
      accepted: true,
      points: 100,
      authoritativeMyContribution: 320,
      updatedTile: null,
      tileId: 't1',
    })

    const result = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'ev-accept',
      sessionId: 's-1',
    })

    expect(result.accepted).toBe(true)
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(outboxItems()).toHaveLength(0)
    expect(h.applied).toHaveLength(1)
    expect(
      (h.applied[0] as { authoritativeMyContribution?: number })
        .authoritativeMyContribution,
    ).toBe(320)
  })

  it('일시 실패(not_ready)면 outbox 에 남고 queued 를 돌려준다', async () => {
    h.submit.mockResolvedValueOnce({ accepted: false, points: 0, reason: 'not_ready' })

    const result = await recordCampusContribution({
      kind: 'stretch_completed',
      eventId: 'ev-transient',
      sessionId: 'stretch-1',
    })

    expect(result.reason).toBe('queued')
    const items = outboxItems()
    expect(items).toHaveLength(1)
    expect(items[0].eventId).toBe('ev-transient')
    expect(items[0].retryCount).toBe(1)
    expect(h.applied).toHaveLength(0)
  })

  it('영구 거절(daily_cap)은 outbox 에서 제거되고 로컬 증가가 없다', async () => {
    h.submit.mockResolvedValueOnce({ accepted: false, points: 0, reason: 'daily_cap' })

    const result = await recordCampusContribution({
      kind: 'posture_recovered',
      eventId: 'ev-cap',
      sessionId: 's-2',
    })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('daily_cap')
    expect(outboxItems()).toHaveLength(0)
    expect(h.applied).toHaveLength(0)
  })

  it('과거 mock 원장이 있어도 live 이벤트를 차단하지 않는다', async () => {
    // v1 mock 원장에 같은 eventId 가 "이미 반영된 것"으로 남아 있는 상황
    localStorage.setItem(
      'upright-now:campus-ledger',
      JSON.stringify({ seenEventIds: ['ev-mock-era'], seenSessionKeys: [], dailyTotals: {}, recoveryBySession: {}, recentEventTimes: [], lastRecoveryAt: null }),
    )
    h.submit.mockResolvedValueOnce({
      accepted: true,
      points: 20,
      authoritativeMyContribution: 20,
    })

    const result = await recordCampusContribution({
      kind: 'stretch_completed',
      eventId: 'ev-mock-era',
      sessionId: 'stretch-2',
    })

    // 서버가 최종 권위 — 로컬 원장으로 선차단하지 않는다
    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(result.accepted).toBe(true)
  })

  it('flush 는 대기 이벤트를 정확히 1회씩 재전송하고 성공분을 제거한다', async () => {
    enqueueOutbox({
      eventId: 'ev-q1',
      kind: 'stretch_completed',
      sessionId: 'stretch-3',
      targetTileId: null,
      occurredAt: Date.now(),
    })
    enqueueOutbox({
      eventId: 'ev-q2',
      kind: 'posture_recovered',
      sessionId: 's-3',
      targetTileId: null,
      occurredAt: Date.now(),
    })
    h.submit.mockResolvedValue({
      accepted: true,
      points: 20,
      authoritativeMyContribution: 40,
    })

    await flushCampusOutbox()

    expect(h.submit).toHaveBeenCalledTimes(2)
    expect(outboxItems()).toHaveLength(0)
    expect(h.applied).toHaveLength(2)
  })

  it('flush 중 일시 실패를 만나면 남은 항목을 유지하고 멈춘다', async () => {
    enqueueOutbox({
      eventId: 'ev-q3',
      kind: 'stretch_completed',
      sessionId: 'stretch-4',
      targetTileId: null,
      occurredAt: Date.now(),
    })
    h.submit.mockResolvedValue({ accepted: false, points: 0, reason: 'not_ready' })

    await flushCampusOutbox()

    expect(outboxItems()).toHaveLength(1)
    expect(outboxItems()[0].retryCount).toBe(1)
  })

  it('outbox 는 새로고침(모듈 캐시 초기화) 후에도 유지된다', async () => {
    enqueueOutbox({
      eventId: 'ev-persist',
      kind: 'stretch_completed',
      sessionId: 'stretch-5',
      targetTileId: null,
      occurredAt: Date.now(),
    })
    const raw = localStorage.getItem('upright-now:campus-outbox')
    expect(raw).toContain('ev-persist')
  })
})
