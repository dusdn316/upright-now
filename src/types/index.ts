/**
 * UpRight Now 핵심 타입
 * 기준: AGENTS.md §4 권장 타입, docs/06 §12, docs/15 §5
 */

/* ---------------------------------- 자세 --------------------------------- */

export type PostureState = 'good' | 'warning' | 'bad' | 'away' | 'unstable'

export type DetectionQuality = 'good' | 'limited' | 'unavailable'

export type DeviationCategory = 'forward' | 'tilt' | 'shoulder' | 'mixed'

export type PostureEngineEvent =
  | 'recovery_started'
  | 'recovery_succeeded'
  | 'recovery_missed'

/**
 * 자세 엔진이 UI·게임에 넘기는 유일한 경계 객체.
 * Phase 1에서는 QA Lab이, Phase 3에서는 MediaPipe가 같은 모양으로 채웁니다.
 * 원시 편차값은 절대 포함하지 않습니다. (docs/06 §12)
 */
export interface PostureSnapshot {
  state: PostureState
  quality: DetectionQuality
  deviationCategory?: DeviationCategory
  recoveryOpportunity?: {
    active: boolean
    remainingMs: number
  }
  event?: PostureEngineEvent
}

/* ---------------------------------- 세션 --------------------------------- */

export type SessionStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'resting'
  | 'completed'
  | 'aborted'

export type SessionMode = 'solo' | 'room'

export interface SessionConfig {
  subject: string
  goal: string
  plannedDurationSec: number
  restDurationSec: number
  profileId: LearningProfileKind
  mode: SessionMode
}

export interface SessionSummary {
  id: string
  startedAt: number
  endedAt: number
  status: 'completed' | 'aborted'
  subject?: string
  goal?: string
  plannedDurationMs: number
  elapsedMs: number
  detectableMs: number
  awayMs: number
  unstableMs: number
  recoveryOpportunities: number
  recoveries: number
  fastestRecoveryMs?: number
  bestCombo: number
  damageDealt: number
  xpEarned: number
  pointsEarned: number
  targetProgress?: 'done' | 'mostly' | 'half' | 'little'
}

/* ------------------------------- 학습 프로필 ------------------------------ */

export type LearningProfileKind = 'library' | 'home' | 'team' | 'custom'

export interface LearningProfile {
  id: LearningProfileKind
  name: string
  description: string
  sound: string
  ambient: string
  stretchKind: string
  accent: 'pink' | 'yellow' | 'blue' | 'green'
  /** components/ui/Icon 의 이름 */
  icon: string
}

/* --------------------------------- 캐릭터 -------------------------------- */

export type CharacterStage = 1 | 2 | 3 | 4 | 5 | 6

/**
 * 세션 중의 일시적 표현 상태.
 * 장기 성장 단계(CharacterStage)와 완전히 분리됩니다. (AGENTS.md §2.5)
 */
export type CharacterVisualState =
  | 'idle'
  | 'warning'
  | 'slouch'
  | 'recover'
  | 'away'

export interface CharacterStageMeta {
  stage: CharacterStage
  name: string
  tagline: string
  requiredXp: number
  /** 이 단계에서 달라지는 외형 설명 */
  visualDiff: string
}

/* --------------------------------- 상점 ---------------------------------- */

export interface StoreItem {
  id: string
  type: 'jacket' | 'backpack'
  name: string
  description: string
  price: number
  assetKey: string
  availableStages: number[]
}

export interface EquippedItems {
  jacketId?: string
  backpackId?: string
}

/* -------------------------------- 친구 방 -------------------------------- */

export type RoomStatus =
  | 'waiting'
  | 'running'
  | 'resting'
  | 'completed'
  | 'closed'

export type RoomMemberState =
  | 'joining'
  | 'ready'
  | 'focusing'
  | 'resting'
  | 'away'
  | 'completed'

/* -------------------------------- 스트레칭 ------------------------------- */

export interface StretchRoutine {
  id: string
  name: string
  durationSec: number
  note: string
  weights: Record<Exclude<LearningProfileKind, 'custom'>, number>
}
