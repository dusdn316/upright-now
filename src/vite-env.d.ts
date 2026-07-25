/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ENABLE_CAMERA?: string
  readonly VITE_ENABLE_FRIEND_ROOM?: string
  readonly VITE_ENABLE_REALTIME?: string
  readonly VITE_ENABLE_PIP?: string
  readonly VITE_ENABLE_QA_LAB?: string
  readonly VITE_ENABLE_CAMPUS_THEME?: string
  readonly VITE_ENABLE_CAMPUS_TERRITORY?: string
  /** 캠퍼스 저장소를 Supabase 로 바꿉니다. migration 을 적용한 프로젝트에서만 켜세요. */
  readonly VITE_ENABLE_CAMPUS_SUPABASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
