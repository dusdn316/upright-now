import { create } from 'zustand'
import type { DeviationDetail, ArbiterPosture } from './classify'
import type { FeatureKey, PointInfo, PointName } from './features'
import type { DetectionQuality, PostureState } from '@/types'

/**
 * Posture Debug 계기판용 상태.
 * 실제 카메라 분류기가 프레임마다 채웁니다. QA Lab(/lab)과
 * ?postureDebug=1 오버레이에서만 표시하고, 운영 일반 화면에는 노출하지 않습니다.
 */
export interface PostureDebugSnapshot {
  updatedAt: number
  /** 카메라 분류기가 살아있는지 */
  live: boolean
  points: Record<PointName, PointInfo> | null
  shoulderWidth: number | null
  /** 기준 어깨 너비 (프로필) */
  baselineShoulderWidth: number | null
  quality: DetectionQuality
  qualityReason: string | null
  /** 특징별 값·기준·편차 (판정에 사용된 것만) */
  details: DeviationDetail[]
  /** 이번 프레임에서 제외된 특징과 이유 */
  excluded: Partial<Record<FeatureKey, string>>
  /** warning/bad 에 투표한 특징 */
  voters: FeatureKey[]
  voteWarning: boolean
  voteBad: boolean
  arbiter: ArbiterPosture
  instant: PostureState
  distanceMismatch: boolean
  yawRatio: number
  multiPerson: boolean
}

const initial: PostureDebugSnapshot = {
  updatedAt: 0,
  live: false,
  points: null,
  shoulderWidth: null,
  baselineShoulderWidth: null,
  quality: 'unavailable',
  qualityReason: null,
  details: [],
  excluded: {},
  voters: [],
  voteWarning: false,
  voteBad: false,
  arbiter: 'good',
  instant: 'unstable',
  distanceMismatch: false,
  yawRatio: 0,
  multiPerson: false,
}

interface PostureDebugStore extends PostureDebugSnapshot {
  report: (partial: Partial<PostureDebugSnapshot>) => void
  reset: () => void
}

export const usePostureDebugStore = create<PostureDebugStore>((set) => ({
  ...initial,
  report: (partial) => set({ ...partial, updatedAt: Date.now(), live: true }),
  reset: () => set(initial),
}))
