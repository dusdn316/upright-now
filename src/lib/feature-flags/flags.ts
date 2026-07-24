/**
 * 기능 플래그 — docs/15_TECHNICAL_ARCHITECTURE.md §13
 * Supabase가 없는 로컬 환경에서도 혼자 모드가 작동해야 합니다.
 */
export interface FeatureFlags {
  /** 실제 웹캠 연결(getUserMedia + Pose Landmarker) */
  camera: boolean
  /** 실제 2인 친구 방(Supabase Realtime) */
  friendRoom: boolean
  realtimeRoom: boolean
  pictureInPicture: boolean
  qaLab: boolean
  optionalSlouchCalibration: boolean
}

export function parseFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback
  return value === 'true' || value === '1'
}

export function readFeatureFlags(env: ImportMetaEnv): FeatureFlags {
  const friendRoom = parseFlag(env.VITE_ENABLE_FRIEND_ROOM, false)

  return {
    camera: parseFlag(env.VITE_ENABLE_CAMERA, false),
    friendRoom,
    // 친구 방이 꺼져 있으면 Realtime 도 켜지 않습니다.
    realtimeRoom: friendRoom && parseFlag(env.VITE_ENABLE_REALTIME, false),
    pictureInPicture: parseFlag(env.VITE_ENABLE_PIP, false),
    // 개발 환경에서는 QA Lab을 기본으로 켭니다. 운영은 명시적으로 켜야 합니다.
    qaLab: parseFlag(env.VITE_ENABLE_QA_LAB, import.meta.env.DEV),
    optionalSlouchCalibration: false,
  }
}

export const featureFlags: FeatureFlags = readFeatureFlags(import.meta.env)
