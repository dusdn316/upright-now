import { create } from 'zustand'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { SessionSummary } from '@/types'

/**
 * 완료·중단한 세션 요약 목록 — docs/15 §5
 * 프레임별 편차 로그는 저장하지 않습니다. 세션당 집계값만 남깁니다.
 */
interface SessionHistoryState {
  summaries: SessionSummary[]
  add: (summary: SessionSummary) => void
  clear: () => void
}

const loaded = loadLocal<SessionSummary[]>(STORAGE_KEYS.sessions, [])

export const useSessionHistoryStore = create<SessionHistoryState>((set) => ({
  summaries: loaded,
  add: (summary) =>
    set((s) => {
      // 최근 100개만 유지합니다.
      const next = [summary, ...s.summaries].slice(0, 100)
      return { summaries: next }
    }),
  clear: () => set({ summaries: [] }),
}))
