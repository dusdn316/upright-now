import { create } from 'zustand'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { Sensitivity } from '@/constants/posture'

/**
 * 개인 자세 기준 요약 — docs/06 §6
 * 원본 프레임과 랜드마크 시계열은 저장하지 않습니다. 요약값만 남깁니다.
 */
export interface FeatureVector {
  /** 어깨 너비로 정규화한 얼굴 폭 (카메라 접근 프록시) */
  faceWidth: number
  /** 어깨 중심 대비 얼굴 중심 x 오프셋 (좌우 기울기) */
  headOffsetX: number
  /** 어깨 중심 대비 얼굴 중심 y 오프셋 (앞으로/숙임 프록시) */
  headOffsetY: number
  /** 좌우 귀 선의 기울기(라디안) */
  headTilt: number
  /** 좌우 어깨 높이 차이 (어깨 너비로 정규화) */
  shoulderTilt: number
}

export interface CalibrationProfile {
  id: string
  name: string
  createdAt: number
  baseline: FeatureVector
  variance: FeatureVector
  quality: {
    sampleCount: number
    meanVisibility: number
  }
}

interface CalibrationStoreState {
  profile: CalibrationProfile | null
  sensitivity: Sensitivity
  setProfile: (profile: CalibrationProfile) => void
  setSensitivity: (value: Sensitivity) => void
  clear: () => void
}

interface PersistShape {
  profile: CalibrationProfile | null
  sensitivity: Sensitivity
}

const loaded = loadLocal<PersistShape>(STORAGE_KEYS.calibration, {
  profile: null,
  sensitivity: 'default',
})

export const useCalibrationStore = create<CalibrationStoreState>((set) => ({
  profile: loaded.profile,
  sensitivity: loaded.sensitivity,
  setProfile: (profile) => set({ profile }),
  setSensitivity: (sensitivity) => set({ sensitivity }),
  clear: () => set({ profile: null }),
}))
