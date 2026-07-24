import { CHARACTER_STAGES } from '@/constants/game'
import type { CharacterStage, CharacterStageMeta } from '@/types'

/**
 * 순수 함수 — 누적 XP만으로 성장 단계를 계산합니다.
 * 자세 상태는 절대 입력이 아닙니다. 단계는 내려가지 않습니다. (AGENTS.md §2.5)
 */
export function xpToStage(xp: number): CharacterStage {
  let stage: CharacterStage = 1
  for (const meta of CHARACTER_STAGES) {
    if (xp >= meta.requiredXp) stage = meta.stage
  }
  return stage
}

export function getStageMeta(stage: CharacterStage): CharacterStageMeta {
  return CHARACTER_STAGES[stage - 1]
}

export interface StageProgress {
  stage: CharacterStage
  meta: CharacterStageMeta
  nextMeta?: CharacterStageMeta
  /** 현재 단계 안에서 쌓은 XP */
  gainedInStage: number
  /** 다음 단계까지 필요한 총 XP 폭 */
  stageSpan: number
  /** 0~1 */
  ratio: number
  remainingXp: number
  isMax: boolean
}

export function getStageProgress(xp: number): StageProgress {
  const stage = xpToStage(xp)
  const meta = getStageMeta(stage)
  const nextMeta = CHARACTER_STAGES[stage] // stage는 1-based이므로 stage 인덱스가 다음 단계

  if (!nextMeta) {
    return {
      stage,
      meta,
      gainedInStage: 0,
      stageSpan: 0,
      ratio: 1,
      remainingXp: 0,
      isMax: true,
    }
  }

  const stageSpan = nextMeta.requiredXp - meta.requiredXp
  const gainedInStage = xp - meta.requiredXp

  return {
    stage,
    meta,
    nextMeta,
    gainedInStage,
    stageSpan,
    ratio: stageSpan === 0 ? 1 : Math.min(1, gainedInStage / stageSpan),
    remainingXp: Math.max(0, nextMeta.requiredXp - xp),
    isMax: false,
  }
}
