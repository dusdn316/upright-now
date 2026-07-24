import { create } from 'zustand'
import { DEFAULT_NICKNAME } from '@/constants/copy'
import { DEFAULT_PROFILE_ID } from '@/constants/profiles'
import type { LearningProfileKind } from '@/types'

/**
 * Phase 1은 메모리 저장만 합니다.
 * IndexedDB(Dexie) 영속화는 Phase 2에서 붙입니다.
 */
interface UserStoreState {
  nickname: string
  hasOnboarded: boolean
  profileId: LearningProfileKind
  hasCalibration: boolean
  soundEnabled: boolean
  setNickname: (value: string) => void
  setProfile: (id: LearningProfileKind) => void
  setCalibrated: (value: boolean) => void
  toggleSound: () => void
  reset: () => void
}


/** 닉네임 정리 — 최대 12자, 제어문자 제거, 빈 값이면 기본 닉네임 (docs/14 §8) */
export function normalizeNickname(raw: string): string {
  const cleaned = Array.from(raw)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code > 0x1f && code !== 0x7f
    })
    .join('')
    .trim()
  if (cleaned.length === 0) return DEFAULT_NICKNAME
  return cleaned.slice(0, 12)
}

const initialState = {
  nickname: DEFAULT_NICKNAME,
  hasOnboarded: false,
  profileId: DEFAULT_PROFILE_ID as LearningProfileKind,
  hasCalibration: false,
  soundEnabled: false,
}

export const useUserStore = create<UserStoreState>((set) => ({
  ...initialState,

  setNickname: (value) =>
    set({ nickname: normalizeNickname(value), hasOnboarded: true }),

  setProfile: (id) => set({ profileId: id }),

  setCalibrated: (value) => set({ hasCalibration: value }),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  reset: () => set(initialState),
}))
