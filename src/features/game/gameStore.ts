import { create } from 'zustand'
import { applyDamage, createBossState, type BossState } from './damage'
import { BOSS_MAX_HP, DAMAGE, REWARD } from '@/constants/game'
import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'

/**
 * 세션 1회 동안의 게임 상태.
 * XP·포인트의 "장기 누적"은 progressionStore가 담당하고,
 * 여기서는 이번 세션에서 번 양만 관리합니다.
 */
interface GameStoreState {
  boss: BossState
  combo: number
  bestCombo: number
  recoveries: number
  opportunities: number
  rewardedRecoveries: number
  sessionXp: number
  sessionPoints: number
  /** 가장 빠른 회복(ms). 회복 기회 시작부터 성공까지 걸린 최소 시간. */
  fastestRecoveryMs?: number
  /** 진행 중인 회복 기회의 시작 시각 */
  opportunityStartedAt?: number
  /** 공격 연출 트리거. 값이 바뀌면 애니메이션을 1회 재생합니다. */
  attackTick: number

  registerOpportunity: (now?: number) => void
  recoverySucceeded: (
    eventId: string,
    now?: number,
  ) => { applied: number; xp: number }
  recoveryMissed: () => void
  sessionCompleted: (eventId: string) => void
  stretchCompleted: () => void
  reset: () => void
}

const initialState = {
  boss: createBossState(BOSS_MAX_HP),
  combo: 0,
  bestCombo: 0,
  recoveries: 0,
  opportunities: 0,
  rewardedRecoveries: 0,
  sessionXp: 0,
  sessionPoints: 0,
  fastestRecoveryMs: undefined as number | undefined,
  opportunityStartedAt: undefined as number | undefined,
  attackTick: 0,
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialState,

  registerOpportunity: (now = Date.now()) =>
    set((s) => ({
      opportunities: s.opportunities + 1,
      opportunityStartedAt: now,
    })),

  recoverySucceeded: (eventId, now = Date.now()) => {
    const prev = get()
    const { state: boss, applied } = applyDamage(prev.boss, {
      eventId,
      amount: DAMAGE.recovery,
    })

    // 중복 이벤트: 아무 것도 적립하지 않습니다.
    if (applied === 0 && prev.boss.processedEventIds.includes(eventId)) {
      return { applied: 0, xp: 0 }
    }

    // XP 추가 지급은 세션당 상한이 있습니다. (docs/06 §11 MAX_REWARDED_RECOVERIES)
    const rewarded = prev.rewardedRecoveries < MAX_REWARDED_RECOVERIES
    const xp = rewarded ? REWARD.recovery.xp : 0
    const points = rewarded ? REWARD.recovery.points : 0
    const combo = prev.combo + 1

    // 회복 기회 시작부터 성공까지 걸린 시간
    const elapsed =
      prev.opportunityStartedAt === undefined
        ? undefined
        : Math.max(0, now - prev.opportunityStartedAt)
    const fastestRecoveryMs =
      elapsed === undefined
        ? prev.fastestRecoveryMs
        : Math.min(prev.fastestRecoveryMs ?? Number.POSITIVE_INFINITY, elapsed)

    set({
      boss,
      combo,
      bestCombo: Math.max(prev.bestCombo, combo),
      recoveries: prev.recoveries + 1,
      rewardedRecoveries: prev.rewardedRecoveries + (rewarded ? 1 : 0),
      sessionXp: prev.sessionXp + xp,
      sessionPoints: prev.sessionPoints + points,
      fastestRecoveryMs,
      opportunityStartedAt: undefined,
      attackTick: prev.attackTick + 1,
    })

    return { applied, xp }
  },

  /** 회복 기회를 놓쳐도 장기 XP는 차감하지 않습니다. 현재 세션 콤보만 0. */
  recoveryMissed: () => set({ combo: 0, opportunityStartedAt: undefined }),

  sessionCompleted: (eventId) =>
    set((prev) => {
      const { state: boss } = applyDamage(prev.boss, {
        eventId,
        amount: DAMAGE.sessionCompleted,
      })
      return {
        boss,
        sessionXp: prev.sessionXp + REWARD.sessionCompleted.xp,
        sessionPoints: prev.sessionPoints + REWARD.sessionCompleted.points,
        attackTick: prev.attackTick + 1,
      }
    }),

  stretchCompleted: () =>
    set((prev) => ({
      sessionXp: prev.sessionXp + REWARD.stretch.xp,
      sessionPoints: prev.sessionPoints + REWARD.stretch.points,
    })),

  reset: () => set({ ...initialState, boss: createBossState(BOSS_MAX_HP) }),
}))

/** 이번 세션에서 보스에게 준 총 피해량 */
export function selectDamageDealt(state: {
  boss: { hp: number; maxHp: number }
}): number {
  return state.boss.maxHp - state.boss.hp
}
