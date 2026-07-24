import { create } from 'zustand'
import {
  createPostureMachine,
  reducePosture,
  type PostureMachineState,
} from './postureMachine'
import type {
  PostureEngineEvent,
  PostureSnapshot,
  PostureState,
} from '@/types'

/**
 * 자세 엔진 → UI 경계.
 *
 * QA Lab과 실제 MediaPipe가 같은 상태 머신(postureMachine)을 공유합니다.
 * 두 경로 모두 순간 분류값을 `setInstant` 로 넣고, `tick(now)` 이 머신을 돌려
 * 회복 기회·성공·실패 이벤트를 만들어 냅니다. 세션·게임·캐릭터 화면은
 * 어느 쪽이 넣었는지 알지 못합니다.
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
  /** 상위 분류기가 넣는 순간 상태 */
  instant: PostureState
  machine: PostureMachineState

  setSource: (source: PostureSource) => void
  /** 순간 분류값을 넣습니다. (즉시 tick 하여 확정 상태를 갱신) */
  setInstant: (state: PostureState, now?: number) => void
  /** 시간을 진행시켜 회복 수명주기를 굴립니다. */
  tick: (now?: number) => void
  /** QA·테스트 호환: 순간값을 넣고 바로 확정합니다. */
  setPostureState: (state: PostureState) => void
  /** 이벤트를 직접 발생시킵니다. (QA 편의) */
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

function qualityFor(state: PostureState): PostureSnapshot['quality'] {
  if (state === 'unstable') return 'limited'
  if (state === 'away') return 'unavailable'
  return 'good'
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export const usePostureStore = create<PostureStoreState>((set, get) => ({
  snapshot: INITIAL_SNAPSHOT,
  lastEvent: null,
  source: 'mock',
  instant: 'unstable',
  machine: createPostureMachine(0),

  setSource: (source) => set({ source }),

  setInstant: (state) => {
    // 순간값을 넣고 확정 상태를 즉시 반영합니다. (회복 수명주기는 tick 이 굴림)
    set((prev) => ({
      instant: state,
      snapshot: {
        ...prev.snapshot,
        state,
        quality: qualityFor(state),
      },
    }))
  },

  tick: (now = nowMs()) => {
    const prev = get()
    const result = reducePosture(prev.machine, { instant: prev.instant, now })

    let lastEvent = prev.lastEvent
    for (const type of result.events) {
      lastEvent = { id: nextEventId(type), type, at: Date.now() }
    }

    set({
      machine: result.state,
      lastEvent,
      snapshot: {
        state: result.state.state,
        quality: qualityFor(result.state.state),
        recoveryOpportunity: result.recoveryOpportunity,
      },
    })
  },

  setPostureState: (state) => get().setInstant(state),

  emitEvent: (type) => {
    const record: PostureEventRecord = {
      id: nextEventId(type),
      type,
      at: Date.now(),
    }
    set({ lastEvent: record })
    return record
  },

  reset: () =>
    set({
      snapshot: INITIAL_SNAPSHOT,
      lastEvent: null,
      instant: 'unstable',
      machine: createPostureMachine(0),
    }),
}))
