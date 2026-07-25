import { create } from 'zustand'
import { DEFAULT_NICKNAME } from '@/constants/copy'
import { DEFAULT_PROFILE_ID } from '@/constants/profiles'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { LearningProfileKind } from '@/types'

/**
 * 실제 사용자 설정을 localStorage 에 저장합니다. (데모 값은 저장하지 않음)
 */
interface UserStoreState {
  nickname: string
  hasOnboarded: boolean
  profileId: LearningProfileKind
  hasCalibration: boolean
  soundEnabled: boolean
  /** 세션 시작 시 PiP 미니 위젯 자동 열기 */
  pipAutoOpen: boolean
  setNickname: (value: string) => void
  setProfile: (id: LearningProfileKind) => void
  setCalibrated: (value: boolean) => void
  toggleSound: () => void
  togglePipAutoOpen: () => void
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
  pipAutoOpen: false,
}

const persisted = loadLocal(STORAGE_KEYS.user, initialState)

export const useUserStore = create<UserStoreState>((set) => ({
  ...initialState,
  ...persisted,

  setNickname: (value) =>
    set({ nickname: normalizeNickname(value), hasOnboarded: true }),

  setProfile: (id) => set({ profileId: id }),

  setCalibrated: (value) => set({ hasCalibration: value }),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  togglePipAutoOpen: () =>
    set((s) => ({ pipAutoOpen: !s.pipAutoOpen })),

  reset: () => set(initialState),
}))
