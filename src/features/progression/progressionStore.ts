import { create } from 'zustand'
import { xpToStage } from './growth'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { CharacterStage, EquippedItems } from '@/types'

/**
 * 장기 성장 — 누적 XP·잎사귀 포인트·출석·인벤토리.
 * 자세가 나빠져도 여기서 값이 줄어드는 경로는 존재하지 않습니다. (AGENTS.md §2.5)
 * 성장 단계는 항상 XP 에서 파생합니다 — 별도 stage 값을 저장하지 않습니다.
 */
export interface XpGainRecord {
  label: string
  xp: number
  at: number
}

interface ProgressionStoreState {
  xp: number
  points: number
  attendance: string[]
  streakClaims: string[]
  badges: string[]
  completedSessions: number
  inventory: string[]
  equipped: EquippedItems
  shopUnlocked: boolean
  /** 최근 획득 XP (최대 5개, 최신 먼저) */
  recentXp: XpGainRecord[]

  addXp: (amount: number) => void
  addPoints: (amount: number) => void
  /** 최근 획득 XP 목록에 기록 — applyReward 가 호출합니다. */
  logXpGain: (label: string, xp: number) => void
  markAttendance: (dateKey: string) => void
  completeSessionMark: (dateKey: string) => void
  /** streak 마일스톤 포인트 지급 — claimKey 로 같은 날 중복 차단 */
  grantStreakBonus: (claimKey: string, points: number, badge?: string) => boolean
  /** 구매 — 포인트 부족·중복 구매를 막습니다. 성공 여부를 돌려줍니다. */
  purchaseItem: (itemId: string, price: number) => boolean
  /** 장착/해제 — 과잠·백팩 각각 하나씩 */
  equipItem: (type: 'jacket' | 'backpack', itemId: string | undefined) => void
  reset: () => void
}

const initialState = {
  // 실제 사용자 초기값입니다. Lv.1 뽀각 거북에서 시작합니다.
  // 데모 값(XP 700 · Lv.3)은 features/demo/demoMode.ts 에서만 주입합니다.
  xp: 0,
  points: 0,
  attendance: [] as string[],
  streakClaims: [] as string[],
  badges: [] as string[],
  completedSessions: 0,
  inventory: [] as string[],
  equipped: {} as EquippedItems,
  shopUnlocked: false,
  recentXp: [] as XpGainRecord[],
}

const persisted = loadLocal(STORAGE_KEYS.progression, initialState)

export const useProgressionStore = create<ProgressionStoreState>((set, get) => ({
  ...initialState,
  ...persisted,
  recentXp: persisted.recentXp ?? [],

  addXp: (amount) => set((s) => ({ xp: s.xp + Math.max(0, amount) })),

  addPoints: (amount) => set((s) => ({ points: s.points + Math.max(0, amount) })),

  logXpGain: (label, xp) =>
    set((s) => ({
      recentXp: [{ label, xp, at: Date.now() }, ...s.recentXp].slice(0, 5),
    })),

  markAttendance: (dateKey) =>
    set((s) =>
      s.attendance.includes(dateKey)
        ? s
        : { attendance: [...s.attendance, dateKey] },
    ),

  /**
   * 세션 완료 표식 — 출석·완료 수·상점 해제만 갱신합니다.
   * XP·포인트는 rewards.applyReward 가 유일한 적립 경로입니다.
   */
  grantStreakBonus: (claimKey, points, badge) => {
    let granted = false
    set((s) => {
      if (s.streakClaims.includes(claimKey)) return s
      granted = true
      return {
        ...s,
        points: s.points + points,
        streakClaims: [...s.streakClaims, claimKey],
        badges:
          badge && !s.badges.includes(badge) ? [...s.badges, badge] : s.badges,
      }
    })
    return granted
  },

  completeSessionMark: (dateKey) =>
    set((s) => ({
      completedSessions: s.completedSessions + 1,
      shopUnlocked: true,
      attendance: s.attendance.includes(dateKey)
        ? s.attendance
        : [...s.attendance, dateKey],
    })),

  purchaseItem: (itemId, price) => {
    const s = get()
    if (s.inventory.includes(itemId)) return false // 중복 구매 금지
    if (s.points < price) return false // 포인트 부족
    set({
      points: s.points - price,
      inventory: [...s.inventory, itemId],
    })
    return true
  },

  equipItem: (type, itemId) => {
    const s = get()
    // 보유하지 않은 아이템은 장착할 수 없습니다.
    if (itemId !== undefined && !s.inventory.includes(itemId)) return
    set({
      equipped:
        type === 'jacket'
          ? { ...s.equipped, jacketId: itemId }
          : { ...s.equipped, backpackId: itemId },
    })
  },

  reset: () => set({ ...initialState }),
}))

/** 파생값 — 스토어에 저장하지 않고 항상 XP에서 계산합니다. */
export function useCharacterStage(): CharacterStage {
  return useProgressionStore((s) => xpToStage(s.xp))
}
