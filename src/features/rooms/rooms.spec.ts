import { describe, expect, it } from 'vitest'
import {
  createGiraffeSync,
  registerRecovery,
  GIRAFFE_SYNC_WINDOW_MS,
} from './giraffeSync'
import { generateRoomCode, sanitizeRoomEvent } from './roomEvents'

describe('기린 싱크 (Gate 2)', () => {
  it('서로 다른 두 참가자의 회복이 10초 안이면 싱크 1회', () => {
    let state = createGiraffeSync()
    const a = registerRecovery(state, {
      eventId: 'e-a',
      participantId: 'p1',
      timestamp: 0,
    })
    state = a.state
    expect(a.sync).toBe(false)

    const b = registerRecovery(state, {
      eventId: 'e-b',
      participantId: 'p2',
      timestamp: 8000,
    })
    expect(b.sync).toBe(true)
    expect(b.pairIds).toEqual(['e-a', 'e-b'])
  })

  it('10초를 넘으면 싱크가 아니다', () => {
    let state = createGiraffeSync()
    state = registerRecovery(state, {
      eventId: 'e-a',
      participantId: 'p1',
      timestamp: 0,
    }).state
    const late = registerRecovery(state, {
      eventId: 'e-b',
      participantId: 'p2',
      timestamp: GIRAFFE_SYNC_WINDOW_MS + 1,
    })
    expect(late.sync).toBe(false)
  })

  it('같은 참가자의 연속 회복은 싱크가 아니다', () => {
    let state = createGiraffeSync()
    state = registerRecovery(state, {
      eventId: 'e-a',
      participantId: 'p1',
      timestamp: 0,
    }).state
    const same = registerRecovery(state, {
      eventId: 'e-a2',
      participantId: 'p1',
      timestamp: 3000,
    })
    expect(same.sync).toBe(false)
  })

  it('같은 회복 이벤트는 재사용되지 않는다', () => {
    let state = createGiraffeSync()
    state = registerRecovery(state, {
      eventId: 'e-a',
      participantId: 'p1',
      timestamp: 0,
    }).state
    const first = registerRecovery(state, {
      eventId: 'e-b',
      participantId: 'p2',
      timestamp: 2000,
    })
    state = first.state
    expect(first.sync).toBe(true)

    // p2 의 두 번째 회복 — 이미 사용된 e-a 와는 다시 싱크되지 않음
    const second = registerRecovery(state, {
      eventId: 'e-c',
      participantId: 'p2',
      timestamp: 4000,
    })
    expect(second.sync).toBe(false)

    // 같은 eventId 재등록도 무시
    const dup = registerRecovery(second.state, {
      eventId: 'e-b',
      participantId: 'p2',
      timestamp: 5000,
    })
    expect(dup.sync).toBe(false)
  })
})

describe('방 이벤트 payload 검증 (Gate 2)', () => {
  const base = {
    id: 'evt-1',
    type: 'recovery_earned',
    participantId: 'p1',
    nickname: '수현',
    timestamp: 1000,
  }

  it('허용된 이벤트는 통과한다', () => {
    expect(sanitizeRoomEvent(base)).toMatchObject({ id: 'evt-1' })
    expect(
      sanitizeRoomEvent({ ...base, type: 'reaction_sent', reaction: 'cheer' }),
    ).not.toBeNull()
  })

  it('자세 좌표·상태 같은 금지 필드가 섞이면 차단한다', () => {
    expect(sanitizeRoomEvent({ ...base, landmarks: [] })).toBeNull()
    expect(sanitizeRoomEvent({ ...base, postureState: 'bad' })).toBeNull()
    expect(sanitizeRoomEvent({ ...base, frame: 'data:image/png' })).toBeNull()
    expect(sanitizeRoomEvent({ ...base, badDurationMs: 100 })).toBeNull()
  })

  it('허용 타입 밖 이벤트를 차단한다', () => {
    expect(sanitizeRoomEvent({ ...base, type: 'chat_message' })).toBeNull()
  })

  it('방 코드는 6자리 영문 대문자·숫자다', () => {
    const code = generateRoomCode(() => 0.5)
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })
})
