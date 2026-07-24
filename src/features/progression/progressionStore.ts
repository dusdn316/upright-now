import { create } from 'zustand'
import { xpToStage } from './growth'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { CharacterStage, EquippedItems } from '@/types'

/**
 * 장기 성장 — 누적 XP·잎사귀 포인트·출석·인벤토리.
 * 자세가 나빠져도 여기서 값이 줄어드는 경로는 존재하지 않습니다. (AGENTS.md §2.5)
 */
interface ProgressionStoreState {
  xp: number
  points: number
  attendance: string[]
  completedSessions: number
  inventory: string[]
  equipped: EquippedItems
  shopUnlocked: boolean

  addXp: (amount: number) => void
  addPoints: (amount: number) => void
  markAttendance: (dateKey: string) => void
  completeSessionMark: (dateKey: string) => void
  reset: () => void
}

const initialState = {
  // 실제 사용자 초기값입니다. Lv.1 뽀각 거북에서 시작합니다.
  // 데모 값(XP 700 · Lv.3)은 features/demo/demoMode.ts 에서만 주입합니다.
  xp: 0,
  points: 0,
  attendance: [] as string[],
  completedSessions: 0,
  inventory: [] as string[],
  equipped: {} as EquippedItems,
  shopUnlocked: false,
}

const persisted = loadLocal(STORAGE_KEYS.progression, initialState)

export const useProgressionStore = create<ProgressionStoreState>((set) => ({
  ...initialState,
  ...persisted,

  addXp: (amount) => set((s) => ({ xp: s.xp + Math.max(0, amount) })),

  addPoints: (amount) => set((s) => ({ points: s.points + Math.max(0, amount) })),

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
  completeSessionMark: (dateKey) =>
    set((s) => ({
      completedSessions: s.completedSessions + 1,
      shopUnlocked: true,
      attendance: s.attendance.includes(dateKey)
        ? s.attendance
        : [...s.attendance, dateKey],
    })),

  reset: () => set({ ...initialState }),
}))

/** 파생값 — 스토어에 저장하지 않고 항상 XP에서 계산합니다. */
export function useCharacterStage(): CharacterStage {
  return useProgressionStore((s) => xpToStage(s.xp))
}
