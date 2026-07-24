import { create } from 'zustand'
import {
  createSessionTimeState,
  tickSession,
  type SessionTimeState,
} from './sessionMachine'
import { releaseSessionLocks } from './sessionLocks'
import { DEFAULT_SESSION_LENGTH_ID, getSessionLength } from '@/constants/session'
import { DEFAULT_PROFILE_ID } from '@/constants/profiles'
import type { LearningProfileKind, PostureState, SessionMode } from '@/types'

interface SessionStoreState extends SessionTimeState {
  sessionId: string
  subject: string
  goal: string
  lengthId: string
  restSec: number
  profileId: LearningProfileKind
  mode: SessionMode
  /** 타이머를 실제 시간의 몇 배로 돌릴지 — QA Lab 전용 */
  timeScale: number

  configure: (input: {
    subject?: string
    goal?: string
    lengthId?: string
    profileId?: LearningProfileKind
    mode?: SessionMode
  }) => void
  start: (sessionId: string) => void
  tick: (deltaMs: number, posture: PostureState) => void
  pause: () => void
  resume: () => void
  finish: (status: 'completed' | 'aborted') => void
  /** QA 데모용 — 남은 시간을 건너뛰고 정상 완료 상태로 만듭니다. */
  completeNow: () => void
  setTimeScale: (scale: number) => void
  reset: () => void
}

const defaultLength = getSessionLength(DEFAULT_SESSION_LENGTH_ID)

const initialState = {
  ...createSessionTimeState(defaultLength.focusSec * 1000),
  sessionId: 'demo',
  subject: '',
  goal: '',
  lengthId: DEFAULT_SESSION_LENGTH_ID,
  restSec: defaultLength.restSec,
  profileId: DEFAULT_PROFILE_ID as LearningProfileKind,
  mode: 'solo' as SessionMode,
  timeScale: 1,
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  ...initialState,

  configure: ({ subject, goal, lengthId, profileId, mode }) =>
    set((s) => {
      const nextLengthId = lengthId ?? s.lengthId
      const option = getSessionLength(nextLengthId)
      return {
        subject: subject ?? s.subject,
        goal: goal ?? s.goal,
        lengthId: nextLengthId,
        plannedMs: option.focusSec * 1000,
        restSec: option.restSec,
        profileId: profileId ?? s.profileId,
        mode: mode ?? s.mode,
      }
    }),

  start: (sessionId) => {
    // 같은 id 재시작 시 종료 잠금·보상 상한을 풀어줍니다. (finalize 는 동적 import 순환 방지)
    releaseSessionLocks(sessionId)
    set((s) => ({
      ...createSessionTimeState(s.plannedMs),
      sessionId,
      status: 'running',
    }))
  },

  tick: (deltaMs, posture) =>
    set((s) => tickSession(s, deltaMs * s.timeScale, posture)),

  pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),

  resume: () => set((s) => (s.status === 'paused' ? { status: 'running' } : s)),

  finish: (status) => set({ status }),

  completeNow: () =>
    set((s) => {
      const remaining = Math.max(0, s.plannedMs - s.elapsedMs)
      return {
        status: 'completed',
        elapsedMs: s.plannedMs,
        // 건너뛴 시간은 감지 가능 시간으로 채웁니다. (away·unstable 은 그대로)
        detectableMs: s.detectableMs + remaining,
      }
    }),

  setTimeScale: (scale) => set({ timeScale: Math.max(1, scale) }),

  reset: () => set({ ...initialState, timeScale: 1 }),
}))
