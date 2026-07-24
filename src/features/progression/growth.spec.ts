import { describe, expect, it } from 'vitest'
import { getStageProgress, xpToStage } from './growth'

describe('xpToStage — 누적 XP만으로 성장 단계를 정한다', () => {
  it.each([
    [0, 1],
    [249, 1],
    [250, 2],
    [599, 2],
    [600, 3],
    [999, 3],
    [1000, 4],
    [1499, 4],
    [1500, 5],
    [2199, 5],
    [2200, 6],
    [99999, 6],
  ])('XP %i → Lv.%i', (xp, stage) => {
    expect(xpToStage(xp)).toBe(stage)
  })

  it('자세 상태는 입력이 아니므로 같은 XP면 항상 같은 단계다', () => {
    expect(xpToStage(600)).toBe(xpToStage(600))
  })
})

describe('getStageProgress', () => {
  it('현재 단계 안에서의 진행률을 계산한다', () => {
    const progress = getStageProgress(800)
    expect(progress.stage).toBe(3)
    expect(progress.nextMeta?.requiredXp).toBe(1000)
    expect(progress.remainingXp).toBe(200)
    expect(progress.ratio).toBeCloseTo(200 / 400)
  })

  it('마지막 단계에서는 isMax 를 돌려준다', () => {
    const progress = getStageProgress(3000)
    expect(progress.stage).toBe(6)
    expect(progress.isMax).toBe(true)
    expect(progress.ratio).toBe(1)
  })
})
