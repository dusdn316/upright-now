import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRetryingClockSkew } from './client'

/**
 * PGRST303 ("JWT issued at future") — Supabase 내부 시계 오차로
 * 익명 가입 직후 첫 요청이 401 로 거부되는 간헐 현상 회귀 테스트.
 * v1.1.0-rc.1 릴리스 프리즈 중 room-live e2e 에서 실측 확인됨.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchRetryingClockSkew', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('PGRST303 401 은 잠시 후 1회 재시도한다', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { code: 'PGRST303', message: 'JWT issued at future' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    const pending = fetchRetryingClockSkew('https://example.test/rest/v1/rpc/create_room', {
      method: 'POST',
      body: '{}',
    })
    await vi.advanceTimersByTimeAsync(1200)
    const res = await pending

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('PGRST303 이 아닌 401 은 재시도 없이 그대로 돌려준다', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { code: 'PGRST301', message: 'JWT expired' }))

    const res = await fetchRetryingClockSkew('https://example.test/rest/v1/rpc/create_room')
    expect(res.status).toBe(401)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('정상 응답은 손대지 않는다', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    const res = await fetchRetryingClockSkew('https://example.test/rest/v1/rooms')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('재시도도 실패하면 두 번째 응답을 그대로 돌려준다 (무한 재시도 없음)', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { code: 'PGRST303', message: 'JWT issued at future' }))

    const pending = fetchRetryingClockSkew('https://example.test/rest/v1/rpc/create_room')
    await vi.advanceTimersByTimeAsync(1200)
    const res = await pending

    expect(res.status).toBe(401)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('JSON 이 아닌 401 응답은 재시도하지 않는다', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))

    const res = await fetchRetryingClockSkew('https://example.test/rest/v1/rooms')
    expect(res.status).toBe(401)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
