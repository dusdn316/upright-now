/**
 * 자세 판정 시간 상수 — docs/06_POSTURE_ENGINE_SPEC.md §11
 * 모두 프로토타입 조정값이며 의료 기준이 아닙니다.
 * 값은 반드시 이 파일에서만 변경합니다. (AGENTS.md §6)
 */
export const BAD_HOLD_MS = 5000
export const RECOVERY_WINDOW_MS = 30000
export const GOOD_RECOVERY_HOLD_MS = 5000
export const RECOVERY_COOLDOWN_MS = 20000
export const AUDIO_ESCALATION_MS = 15000
export const AWAY_PROMPT_MS = 60000
export const MAX_REWARDED_RECOVERIES = 5

/** 보상·회복 판정을 멈추는 상태 (AGENTS.md §2.2) */
export const REWARD_PAUSED_STATES = ['away', 'unstable'] as const

export type Sensitivity = 'gentle' | 'default' | 'sensitive'
