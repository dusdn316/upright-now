import { useProgressionStore } from '@/features/progression/progressionStore'
import { useGameStore } from './gameStore'
import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'
import { REWARD } from '@/constants/game'
import { registerSessionLockRelease } from '@/features/sessions/sessionLocks'

/**
 * 보상 처리의 단일 진입점.
 * XP·잎사귀 포인트는 반드시 이 함수를 통해서만 적립됩니다.
 *
 * - 동일 id 는 두 번 적용되지 않습니다.
 * - recovery_success 의 XP·포인트 반영은 세션당 최대 5회입니다.
 *   (6회 이후에도 실제 회복 횟수는 gameStore 에 기록됩니다.)
 * - session_aborted 는 완료 보상이 없습니다.
 */
export type RewardType =
  | 'recovery_success'
  | 'session_completed'
  | 'stretch_completed'
  | 'goal_completed'

const REWARD_TABLE: Record<RewardType, { xp: number; points: number }> = {
  recovery_success: REWARD.recovery,
  session_completed: REWARD.sessionCompleted,
  stretch_completed: REWARD.stretch,
  goal_completed: REWARD.goalCompleted,
}

/** 세션 중 화면 집계(획득 XP·잎사귀)에 반영되는 종류 */
const SESSION_SCOPED: RewardType[] = ['recovery_success', 'session_completed']

/** 최근 획득 XP 목록에 남길 이름 */
const REWARD_LABEL: Record<RewardType, string> = {
  recovery_success: '자세 회복',
  session_completed: '세션 완주',
  stretch_completed: '스트레칭',
  goal_completed: '목표 완료',
}

const appliedIds = new Set<string>()
const recoveryCountBySession = new Map<string, number>()

// 세션 재시작 시 회복 보상 상한을 초기화합니다.
registerSessionLockRelease((sessionId) => recoveryCountBySession.delete(sessionId))

export interface RewardInput {
  id: string
  sessionId: string
  type: RewardType
}

export interface RewardOutcome {
  applied: boolean
  xp: number
  points: number
  /** recovery 상한에 걸려 0 이 지급된 경우 true */
  capped: boolean
}

export function applyReward(input: RewardInput): RewardOutcome {
  const { id, sessionId, type } = input

  if (appliedIds.has(id)) {
    return { applied: false, xp: 0, points: 0, capped: false }
  }
  appliedIds.add(id)

  let { xp, points } = REWARD_TABLE[type]
  let capped = false

  if (type === 'recovery_success') {
    const count = recoveryCountBySession.get(sessionId) ?? 0
    if (count >= MAX_REWARDED_RECOVERIES) {
      xp = 0
      points = 0
      capped = true
    } else {
      recoveryCountBySession.set(sessionId, count + 1)
    }
  }

  if (xp > 0) {
    useProgressionStore.getState().addXp(xp)
    useProgressionStore.getState().logXpGain(REWARD_LABEL[type], xp)
  }
  if (points > 0) useProgressionStore.getState().addPoints(points)

  if (SESSION_SCOPED.includes(type) && (xp > 0 || points > 0)) {
    useGameStore.getState().addSessionEarnings(xp, points)
  }

  return { applied: true, xp, points, capped }
}

/** 새 세션이 시작될 때 세션 단위 상한을 초기화합니다. */
export function resetSessionRewards(sessionId: string): void {
  recoveryCountBySession.delete(sessionId)
}

/** 테스트 전용 */
export function resetRewardsForTest(): void {
  appliedIds.clear()
  recoveryCountBySession.clear()
}
