import { create } from 'zustand'
import type {
  PostureEngineEvent,
  PostureSnapshot,
  PostureState,
} from '@/types'

/**
 * 자세 엔진 → UI 경계.
 *
 * Phase 1: QA Lab이 이 스토어에 스냅샷을 주입합니다.
 * Phase 3: MediaPipe 어댑터가 같은 모양으로 주입합니다.
 * 세션·게임·캐릭터 화면은 어느 쪽이 주입했는지 알지 못합니다.
 */
export interface PostureEventRecord {
  id: string
  type: PostureEngineEvent
  at: number
}

export type PostureSource = 'mock' | 'mediapipe'

interface PostureStoreState {
  snapshot: PostureSnapshot
  lastEvent: PostureEventRecord | null
  source: PostureSource
  setSnapshot: (snapshot: PostureSnapshot) => void
  setPostureState: (state: PostureState) => void
  emitEvent: (type: PostureEngineEvent) => PostureEventRecord
  reset: () => void
}

export const INITIAL_SNAPSHOT: PostureSnapshot = {
  state: 'unstable',
  quality: 'unavailable',
}

let eventSeq = 0

function nextEventId(type: PostureEngineEvent): string {
  eventSeq += 1
  return `${type}-${eventSeq}`
}

/** 테스트에서 이벤트 ID를 예측 가능하게 만들기 위한 헬퍼 */
export function resetEventSeq(): void {
  eventSeq = 0
}

export const usePostureStore = create<PostureStoreState>((set) => ({
  snapshot: INITIAL_SNAPSHOT,
  lastEvent: null,
  source: 'mock',

  setSnapshot: (snapshot) => set({ snapshot }),

  setPostureState: (state) =>
    set((prev) => ({
      snapshot: {
        ...prev.snapshot,
        state,
        quality:
          state === 'unstable'
            ? 'limited'
            : state === 'away'
              ? 'unavailable'
              : 'good',
      },
    })),

  emitEvent: (type) => {
    const record: PostureEventRecord = {
      id: nextEventId(type),
      type,
      at: Date.now(),
    }
    set({ lastEvent: record })
    return record
  },

  reset: () => set({ snapshot: INITIAL_SNAPSHOT, lastEvent: null }),
}))
