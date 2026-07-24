import { describe, expect, it } from 'vitest'
import { recommendStretch } from './recommend'
import { STRETCH_ROUTINES } from '@/constants/stretch'

describe('recommendStretch — 모드별 가중 랜덤 (docs/09 §4)', () => {
  it('직전 동작은 다시 추천하지 않는다', () => {
    for (const routine of STRETCH_ROUTINES) {
      const next = recommendStretch('home', routine.id, () => 0.99)
      expect(next.id).not.toBe(routine.id)
    }
  })

  it('가중치가 반영된다 — 도서관은 조용한 동작 비중이 높다', () => {
    // rand=0 이면 첫 후보가 뽑힘. 도서관에서 종아리 올리기(가중치 1)는 잘 안 나온다.
    const counts = new Map<string, number>()
    let seed = 0
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = 0; i < 2000; i += 1) {
      const r = recommendStretch('library', undefined, rand)
      counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
    }
    const calf = counts.get('calf-raise') ?? 0
    const shoulder = counts.get('shoulder-roll') ?? 0
    expect(calf).toBeLessThan(shoulder)
  })
})
