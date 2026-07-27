import { create } from 'zustand'

/**
 * 캠퍼스 기여 피드백 버스.
 *
 * recordCampusContribution 은 React 밖에서 호출되므로, 결과를 여기에 쌓고
 * ToastProvider 안의 <CampusFeedbackToaster /> 가 구독해 토스트로 보여 줍니다.
 * 서버 거절 사유를 콘솔에만 숨기지 않기 위한 단일 통로입니다(§5-E).
 */
export interface CampusFeedbackItem {
  id: number
  tone: 'success' | 'info' | 'warning'
  title: string
  description?: string
}

interface FeedbackState {
  queue: CampusFeedbackItem[]
  push: (item: Omit<CampusFeedbackItem, 'id'>) => void
  drain: () => CampusFeedbackItem[]
}

let seq = 0

export const useCampusFeedbackStore = create<FeedbackState>((set, get) => ({
  queue: [],
  push: (item) => {
    seq += 1
    set((s) => ({ queue: [...s.queue, { ...item, id: seq }].slice(-6) }))
  },
  drain: () => {
    const items = get().queue
    if (items.length > 0) set({ queue: [] })
    return items
  },
}))

export function pushCampusFeedback(item: Omit<CampusFeedbackItem, 'id'>): void {
  useCampusFeedbackStore.getState().push(item)
}
