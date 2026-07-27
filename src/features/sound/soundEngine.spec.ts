import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetSoundEngineForTest,
  PACK_EVENTS,
  playSound,
  resolvePlayback,
  SOUND_MANIFEST,
} from './soundEngine'
import { useUserStore } from '@/features/onboarding/userStore'
import { useModeStore } from '@/features/modes/modeStore'

describe('resolvePlayback — 소리 재생 결정 (순수 로직)', () => {
  const base = {
    event: 'recovery_success' as const,
    globalSoundOn: true,
    pack: 'soft' as const,
    ctxRunning: true,
    now: 10_000,
  }

  it('전역 소리 OFF 가 최우선 — 모든 팩에서 무음', () => {
    for (const pack of ['silent', 'soft', 'social'] as const) {
      expect(resolvePlayback({ ...base, pack, globalSoundOn: false })).toBe(false)
    }
  })

  it('silent 팩(도서관 기본)은 어떤 이벤트도 재생하지 않는다', () => {
    for (const event of Object.keys(SOUND_MANIFEST) as Array<
      keyof typeof SOUND_MANIFEST
    >) {
      expect(resolvePlayback({ ...base, pack: 'silent', event })).toBe(false)
    }
  })

  it('soft(내 공간)는 회복·완료 소리를 내고 협동 소리는 내지 않는다', () => {
    expect(resolvePlayback({ ...base, event: 'recovery_success' })).toBe(true)
    expect(resolvePlayback({ ...base, event: 'session_complete' })).toBe(true)
    expect(resolvePlayback({ ...base, event: 'reaction_received' })).toBe(false)
    expect(resolvePlayback({ ...base, event: 'giraffe_sync' })).toBe(false)
  })

  it('social(팀플)은 반응·기린 싱크 소리까지 낸다', () => {
    expect(
      resolvePlayback({ ...base, pack: 'social', event: 'reaction_received' }),
    ).toBe(true)
    expect(
      resolvePlayback({ ...base, pack: 'social', event: 'giraffe_sync' }),
    ).toBe(true)
  })

  it('사용자 제스처 전(AudioContext 미가동)에는 재생하지 않는다', () => {
    expect(resolvePlayback({ ...base, ctxRunning: false })).toBe(false)
  })

  it('같은 이벤트는 짧은 간격 내 중복 재생하지 않는다', () => {
    expect(resolvePlayback({ ...base, lastAt: base.now - 100 })).toBe(false)
    expect(resolvePlayback({ ...base, lastAt: base.now - 1000 })).toBe(true)
  })

  it('social 은 soft 의 모든 이벤트를 포함한다', () => {
    for (const event of PACK_EVENTS.soft) {
      expect(PACK_EVENTS.social).toContain(event)
    }
  })
})

describe('playSound — AudioContext mock 통합', () => {
  function makeFakeCtx() {
    const oscillators: unknown[] = []
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
    const ctx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: vi.fn(() => gain),
      createOscillator: vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }
        oscillators.push(osc)
        return osc
      }),
    }
    return { ctx: ctx as unknown as AudioContext, oscillators }
  }

  beforeEach(() => {
    useUserStore.setState({ soundEnabled: true })
    useModeStore.getState().setActiveMode('home') // soft 팩
  })

  afterEach(() => {
    __resetSoundEngineForTest(null)
    useUserStore.setState({ soundEnabled: false })
    useModeStore.getState().reset()
  })

  it('soft 팩에서 회복 성공음을 합성 재생한다', () => {
    const { ctx, oscillators } = makeFakeCtx()
    __resetSoundEngineForTest(ctx)
    playSound('recovery_success')
    expect(oscillators.length).toBe(SOUND_MANIFEST.recovery_success.tones.length)
  })

  it('같은 이벤트 즉시 재호출은 무시된다', () => {
    const { ctx, oscillators } = makeFakeCtx()
    __resetSoundEngineForTest(ctx)
    playSound('recovery_success')
    playSound('recovery_success')
    expect(oscillators.length).toBe(SOUND_MANIFEST.recovery_success.tones.length)
  })

  it('도서관(silent) 모드에서는 재생하지 않는다', () => {
    useModeStore.getState().setActiveMode('library')
    const { ctx, oscillators } = makeFakeCtx()
    __resetSoundEngineForTest(ctx)
    playSound('recovery_success')
    expect(oscillators.length).toBe(0)
  })
})
