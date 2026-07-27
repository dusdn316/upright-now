import { create } from 'zustand'
import type { CampusSchoolDirectoryEntry } from './types'

/**
 * 서버 학교 디렉터리 스토어 — 의존성 없는 말단 모듈.
 * (campusThemeStore ↔ schoolDirectory 순환을 끊기 위해 분리)
 * created_by 등 소유 정보는 서버가 보내지 않으므로 여기 존재하지 않습니다.
 */
interface DirectoryState {
  entries: Record<string, CampusSchoolDirectoryEntry>
  loadedAt: number | null
  setEntries: (list: CampusSchoolDirectoryEntry[]) => void
  upsertEntry: (entry: CampusSchoolDirectoryEntry) => void
  removeEntry: (id: string) => void
  reset: () => void
}

export const useCampusDirectoryStore = create<DirectoryState>((set) => ({
  entries: {},
  loadedAt: null,
  setEntries: (list) =>
    set({
      entries: Object.fromEntries(list.map((e) => [e.id, e])),
      loadedAt: Date.now(),
    }),
  upsertEntry: (entry) =>
    set((s) => ({ entries: { ...s.entries, [entry.id]: entry } })),
  removeEntry: (id) =>
    set((s) => {
      const next = { ...s.entries }
      delete next[id]
      return { entries: next }
    }),
  reset: () => set({ entries: {}, loadedAt: null }),
}))
