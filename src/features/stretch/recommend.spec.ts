import { describe, expect, it } from 'vitest'
import { recommendStretch } from './recommend'
import { STRETCH_ROUTINES } from '@/constants/stretch'

function seededRand(): () => number {
  let seed = 0
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

function tally(pref: 'seated' | 'mixed' | 'full', runs = 2000): Map<string, number> {
  const rand = seededRand()
  const counts = new Map<string, number>()
  for (let i = 0; i < runs; i += 1) {
    const r = recommendStretch(pref, undefined, rand)
    counts.set(r.id, (counts.get(r.id) ?? 0) + 1)
  }
  return counts
}

describe('recommendStretch — stretch 설정 기반 가중 랜덤 (docs/09 §4)', () => {
  it('직전 동작은 다시 추천하지 않는다', () => {
    for (const pref of ['seated', 'mixed', 'full'] as const) {
      for (const routine of STRETCH_ROUTINES) {
        const next = recommendStretch(pref, routine.id, () => 0.99)
        expect(next.id).not.toBe(routine.id)
      }
    }
  })

  it('seated 는 서서 하는 calf-raise 가 최소 가중이다', () => {
    const counts = tally('seated')
    const calf = counts.get('calf-raise') ?? 0
    const shoulder = counts.get('shoulder-roll') ?? 0
    expect(calf).toBeLessThan(shoulder)
  })

  it('full 은 seated 보다 calf-raise 가중이 높다', () => {
    const seatedCalf = tally('seated').get('calf-raise') ?? 0
    const fullCalf = tally('full').get('calf-raise') ?? 0
    expect(fullCalf).toBeGreaterThan(seatedCalf * 2)
  })

  it('mixed 는 전체를 균형 있게 뽑는다 (모든 동작이 등장)', () => {
    const counts = tally('mixed')
    for (const routine of STRETCH_ROUTINES) {
      expect(counts.get(routine.id) ?? 0).toBeGreaterThan(0)
    }
  })
})
