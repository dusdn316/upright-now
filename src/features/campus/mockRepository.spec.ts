import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MockCampusRepository, resetMockCampusForTest } from './mockRepository'
import { CONTRIBUTION_POINTS } from './contribution'
import type { CampusContributionEvent, CampusSnapshot } from './types'

const NOW = Date.UTC(2026, 6, 20, 3, 0, 0)
const now = () => NOW

function event(overrides: Partial<CampusContributionEvent> = {}): CampusContributionEvent {
  return {
    eventId: 'evt-1',
    kind: 'session_completed',
    seasonId: 'season-1',
    schoolId: 'snu',
    memberId: 'member-a',
    sessionId: 'session-1',
    tileId: 'tile',
    points: CONTRIBUTION_POINTS.session_completed,
    occurredAt: NOW,
    ...overrides,
  }
}

describe('mock 캠퍼스 저장소', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMockCampusForTest()
  })

  afterEach(() => {
    resetMockCampusForTest()
    localStorage.clear()
  })

  it('mock 데이터로 지도·시즌·순위를 만들어 준다', async () => {
    const repo = new MockCampusRepository(() => ({ memberId: 'a', schoolId: 'snu' }), now)
    const snapshot = await repo.load()

    expect(snapshot.tiles).toHaveLength(96)
    expect(snapshot.season.endsAt).toBeGreaterThan(snapshot.season.startsAt)
    expect(snapshot.standings.length).toBeGreaterThan(0)
    expect(snapshot.standings.every((s) => s.normalizedScore >= 0)).toBe(true)
    repo.dispose()
  })

  it('같은 시즌은 새로고침해도 같은 지도를 준다 (결정적 시드)', async () => {
    const first = new MockCampusRepository(() => ({ memberId: 'a', schoolId: null }), now)
    const a = await first.load()
    first.dispose()
    resetMockCampusForTest()
    localStorage.clear()

    const second = new MockCampusRepository(() => ({ memberId: 'a', schoolId: null }), now)
    const b = await second.load()
    second.dispose()

    expect(b.tiles.map((t) => t.ownerSchoolId)).toEqual(a.tiles.map((t) => t.ownerSchoolId))
  })

  it('두 클라이언트가 실시간으로 같은 지도를 본다', async () => {
    const identity = () => ({ memberId: 'member-a', schoolId: 'snu' })
    const clientA = new MockCampusRepository(identity, now)
    const clientB = new MockCampusRepository(
      () => ({ memberId: 'member-b', schoolId: 'korea' }),
      now,
    )

    const initial = await clientA.load()
    await clientB.load()

    const seen: CampusSnapshot[] = []
    clientA.subscribe((snapshot) => seen.push(snapshot))

    const target = initial.tiles.find(
      (t) => t.ownerSchoolId !== 'korea' && !t.challengerSchoolId,
    )!
    const result = await clientB.submitContribution(
      event({ schoolId: 'korea', memberId: 'member-b', tileId: target.id, eventId: 'b-1' }),
    )

    expect(result.accepted).toBe(true)
    // B 가 넣은 기여가 A 의 화면에 즉시 반영됩니다.
    expect(seen.length).toBeGreaterThan(0)
    const latest = seen[seen.length - 1]
    const updated = latest.tiles.find((t) => t.id === target.id)!
    expect(
      updated.challengerSchoolId === 'korea' || updated.ownerSchoolId === 'korea',
    ).toBe(true)

    clientA.dispose()
    clientB.dispose()
  })

  it('같은 eventId 는 두 번 반영되지 않는다', async () => {
    const repo = new MockCampusRepository(
      () => ({ memberId: 'member-a', schoolId: 'snu' }),
      now,
    )
    const snapshot = await repo.load()
    const target = snapshot.tiles[0]

    const first = await repo.submitContribution(event({ tileId: target.id }))
    const second = await repo.submitContribution(event({ tileId: target.id }))

    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(false)
    expect(second.reason).toBe('duplicate_event')

    const after = await repo.load()
    expect(after.myContribution).toBe(CONTRIBUTION_POINTS.session_completed)
    repo.dispose()
  })

  it('학교를 바꾸면 이전 학교 기여도가 따라오지 않는다', async () => {
    let schoolId: string | null = 'snu'
    const repo = new MockCampusRepository(
      () => ({ memberId: 'member-a', schoolId }),
      now,
    )
    const snapshot = await repo.load()
    await repo.submitContribution(
      event({ schoolId: 'snu', tileId: snapshot.tiles[0].id, eventId: 'snu-1' }),
    )
    expect((await repo.load()).myContribution).toBe(100)

    schoolId = 'korea'
    expect((await repo.load()).myContribution).toBe(0)

    // 다시 돌아오면 원래 학교의 기여도는 그대로 남아 있습니다.
    schoolId = 'snu'
    expect((await repo.load()).myContribution).toBe(100)
    repo.dispose()
  })

  it('점령이 일어나면 타일 이벤트 로그가 쌓인다', async () => {
    const repo = new MockCampusRepository(() => ({ memberId: 'a', schoolId: 'snu' }), now)
    const snapshot = await repo.load()
    const neutral = snapshot.tiles.find((t) => !t.ownerSchoolId)!

    let captured = false
    for (let i = 0; i < 40 && !captured; i += 1) {
      const result = await repo.submitContribution(
        event({ tileId: neutral.id, eventId: `cap-${i}`, sessionId: `s-${i}` }),
      )
      captured = Boolean(result.captured)
    }

    expect(captured).toBe(true)
    const after = await repo.load()
    expect(after.tiles.find((t) => t.id === neutral.id)?.ownerSchoolId).toBe('snu')
    expect(after.tileEvents.some((e) => e.kind === 'captured' && e.tileId === neutral.id)).toBe(
      true,
    )
    repo.dispose()
  })

  it('저장된 캠퍼스 데이터에 카메라·랜드마크·자세 상태가 없다', async () => {
    const repo = new MockCampusRepository(() => ({ memberId: 'a', schoolId: 'snu' }), now)
    const snapshot = await repo.load()
    await repo.submitContribution(event({ tileId: snapshot.tiles[0].id }))

    const raw = localStorage.getItem('upright-now:campus-mock') ?? ''
    expect(raw.length).toBeGreaterThan(0)
    for (const forbidden of [
      'landmark',
      'camera',
      'frame',
      'video',
      'cva',
      'deviation',
      'postureState',
      'badMs',
      'awayMs',
      'slouch',
    ]) {
      expect(raw.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
    repo.dispose()
  })
})
