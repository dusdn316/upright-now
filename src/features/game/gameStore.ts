import { create } from 'zustand'
import { applyDamage, createBossState, type BossState } from './damage'
import { BOSS_MAX_HP, DAMAGE } from '@/constants/game'

/**
 * 세션 1회 동안의 전투·집계 상태.
 *
 * XP·포인트 적립은 여기서 하지 않습니다 — 반드시 rewards.applyReward 를 통합니다.
 * 이 스토어는 보스 피해·콤보·횟수와 "화면 표시용" 세션 획득 집계만 담습니다.
 */
interface GameStoreState {
  boss: BossState
  combo: number
  bestCombo: number
  recoveries: number
  opportunities: number
  /** 화면 표시용 — applyReward 가 채웁니다 */
  sessionXp: number
  sessionPoints: number
  /** 가장 빠른 회복(ms). 회복 기회 시작부터 성공까지 걸린 최소 시간. */
  fastestRecoveryMs?: number
  opportunityStartedAt?: number
  /** 공격 연출 트리거. 값이 바뀌면 애니메이션을 1회 재생합니다. */
  attackTick: number

  registerOpportunity: (now?: number) => void
  /** 보스 피해 + 콤보. XP 는 applyReward 몫입니다. 중복 eventId 는 무시됩니다. */
  recoverySucceeded: (eventId: string, now?: number) => { applied: number }
  recoveryMissed: () => void
  sessionCompleted: (eventId: string) => void
  /** 유효 감지 집중 5분마다 — 시각 연출 포함, XP 없음 */
  focusAttack: (eventId: string) => void
  /** 개인 괴물 장기 진행도 동기화용 — 세션 시작 시 저장된 HP 를 주입 */
  setBoss: (hp: number, maxHp: number) => void
  addSessionEarnings: (xp: number, points: number) => void
  reset: () => void
}

const initialState = {
  boss: createBossState(BOSS_MAX_HP),
  combo: 0,
  bestCombo: 0,
  recoveries: 0,
  opportunities: 0,
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

    // 중복 이벤트: 아무 것도 바꾸지 않습니다.
    if (applied === 0 && prev.boss.processedEventIds.includes(eventId)) {
      return { applied: 0 }
    }

    const combo = prev.combo + 1
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
      fastestRecoveryMs,
      opportunityStartedAt: undefined,
      attackTick: prev.attackTick + 1,
    })

    return { applied }
  },

  /** 회복 기회를 놓쳐도 장기 XP는 차감하지 않습니다. 현재 세션 콤보만 0. */
  recoveryMissed: () => set({ combo: 0, opportunityStartedAt: undefined }),

  sessionCompleted: (eventId) =>
    set((prev) => {
      const { state: boss } = applyDamage(prev.boss, {
        eventId,
        amount: DAMAGE.sessionCompleted,
      })
      return { boss, attackTick: prev.attackTick + 1 }
    }),

  addSessionEarnings: (xp, points) =>
    set((s) => ({
      sessionXp: s.sessionXp + Math.max(0, xp),
      sessionPoints: s.sessionPoints + Math.max(0, points),
    })),

  focusAttack: (eventId) =>
    set((prev) => {
      const { state: boss, applied } = applyDamage(prev.boss, {
        eventId,
        amount: DAMAGE.focus,
      })
      if (applied === 0) return prev
      return { boss, attackTick: prev.attackTick + 1 }
    }),

  setBoss: (hp, maxHp) =>
    set((prev) => ({ boss: { ...prev.boss, hp, maxHp } })),

  reset: () => set({ ...initialState, boss: createBossState(BOSS_MAX_HP) }),
}))

/** 이번 세션에서 보스에게 준 총 피해량 */
export function selectDamageDealt(state: {
  boss: { hp: number; maxHp: number }
}): number {
  return state.boss.maxHp - state.boss.hp
}
