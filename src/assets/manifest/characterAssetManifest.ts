import { getStageMeta } from '@/features/progression/growth'
import type { CharacterStage, PostureState } from '@/types'

/**
 * 캐릭터 이미지 경로의 단일 소스 — docs/10 §7, docs/18 §10
 * 컴포넌트 안에 파일 경로를 하드코딩하지 않습니다.
 *
 * 원본: incoming-assets/*.png (1024x1024, 투명 배경)
 * 변환: node scripts/convert-characters.mjs → public/assets/characters/
 */
export type CharacterAssetState =
  | 'idle'
  | 'warning'
  | 'slouch'
  | 'recover'
  | 'attack'
  | 'away'

/** 세션 중 캐릭터가 취하는 표현 (자세 상태와 별개로 게임이 지정) */
export type CharacterVisualIntent = 'idle' | 'recover' | 'attack'

const BASE = '/assets/characters'

export const CHARACTER_ASSETS: Record<
  CharacterStage,
  Partial<Record<CharacterAssetState, string>>
> = {
  1: {
    idle: `${BASE}/stage-01/idle.webp`,
    warning: `${BASE}/stage-01/warning.webp`,
    slouch: `${BASE}/stage-01/slouch.webp`,
    recover: `${BASE}/stage-01/recover.webp`,
    attack: `${BASE}/stage-01/attack.webp`,
  },
  2: { idle: `${BASE}/stage-02/idle.webp` },
  3: {
    idle: `${BASE}/stage-03/idle.webp`,
    warning: `${BASE}/stage-03/warning.webp`,
    slouch: `${BASE}/stage-03/slouch.webp`,
    recover: `${BASE}/stage-03/recover.webp`,
    attack: `${BASE}/stage-03/attack.webp`,
  },
  4: { idle: `${BASE}/stage-04/idle.webp` },
  5: { idle: `${BASE}/stage-05/idle.webp` },
  6: { idle: `${BASE}/stage-06/idle.webp` },
}

/** 자세 상태 → 에셋 상태 */
const POSTURE_TO_ASSET: Record<PostureState, CharacterAssetState> = {
  good: 'idle',
  warning: 'warning',
  bad: 'slouch',
  away: 'away',
  unstable: 'idle',
}

/**
 * 지금 보여줄 에셋 상태를 정합니다.
 * 게임이 지정한 표현(recover·attack)이 자세 상태보다 우선합니다.
 */
export function resolveAssetState(
  postureState: PostureState = 'good',
  visualState: CharacterVisualIntent = 'idle',
): CharacterAssetState {
  if (visualState === 'attack') return 'attack'
  if (visualState === 'recover') return 'recover'
  return POSTURE_TO_ASSET[postureState]
}

export interface ResolvedCharacterAsset {
  src: string
  /** 실제로 찾은 상태. 요청한 상태가 없으면 idle 로 내려옵니다. */
  state: CharacterAssetState
  /** 요청한 상태 그대로인지 */
  exact: boolean
}

/**
 * 폴백 순서: 정확한 상태 → 해당 단계의 idle → null(= CharacterSvg)
 * `unavailable` 에 담긴 경로는 로딩에 실패한 것으로 보고 건너뜁니다.
 */
export function resolveCharacterAsset(
  stage: CharacterStage,
  state: CharacterAssetState,
  unavailable: ReadonlySet<string> = new Set(),
): ResolvedCharacterAsset | null {
  const stageAssets = CHARACTER_ASSETS[stage] ?? {}

  const exact = stageAssets[state]
  if (exact && !unavailable.has(exact)) {
    return { src: exact, state, exact: true }
  }

  const idle = stageAssets.idle
  if (idle && !unavailable.has(idle)) {
    return { src: idle, state: 'idle', exact: state === 'idle' }
  }

  return null
}

const STATE_DESCRIPTION: Record<CharacterAssetState, string> = {
  idle: '편안하게 공부하는 모습',
  warning: '자세가 조금 달라진 모습',
  slouch: '몸을 움츠린 모습',
  recover: '자세를 회복하는 모습',
  attack: '회복 에너지로 특수 공격을 하는 모습',
  away: '자리를 비운 사이 기다리는 모습',
}

/** 이미지가 뜻을 전달하므로 상태까지 담은 대체 텍스트를 만듭니다. (docs/10 §9) */
export function describeCharacter(
  stage: CharacterStage,
  state: CharacterAssetState,
): string {
  const meta = getStageMeta(stage)
  return `Lv.${meta.stage} ${meta.name}이 ${STATE_DESCRIPTION[state]}`
}
