import { create } from 'zustand'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { FeatureKey } from '@/features/posture-engine/features'
import type { Sensitivity } from '@/constants/posture'

/**
 * 개인 자세 기준 요약 v2 — 특징별 median + MAD + 유효 표본 수.
 * 평균만 저장하지 않습니다. 원본 프레임·랜드마크 시계열은 저장하지 않습니다.
 */
export interface FeatureStat {
  median: number
  mad: number
  validSampleCount: number
}

export interface CalibrationProfile {
  version: 2
  id: string
  name: string
  createdAt: number
  /** 유효 표본이 충분했던 특징만 담김 */
  features: Partial<Record<FeatureKey, FeatureStat>>
  shoulderWidthMedian: number
  /** 카메라 식별용 안전한 해시 (원본 deviceId 아님) */
  deviceIdHash: string | null
  quality: {
    validSampleCount: number
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

// v2 스키마가 아닌 프로필은 사용하지 않습니다. (마이그레이션이 이미 걸러줌)
const validProfile =
  loaded.profile && loaded.profile.version === 2 ? loaded.profile : null

export const useCalibrationStore = create<CalibrationStoreState>((set) => ({
  profile: validProfile,
  sensitivity: loaded.sensitivity,
  setProfile: (profile) => set({ profile }),
  setSensitivity: (sensitivity) => set({ sensitivity }),
  clear: () => set({ profile: null }),
}))

/** deviceId 를 저장 가능한 짧은 해시로 바꿉니다. (djb2, 복원 불가) */
export function hashDeviceId(deviceId: string | null | undefined): string | null {
  if (!deviceId) return null
  let hash = 5381
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = ((hash << 5) + hash + deviceId.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}
