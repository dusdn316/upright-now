/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_ENABLE_CAMERA?: string
  readonly VITE_ENABLE_FRIEND_ROOM?: string
  readonly VITE_ENABLE_REALTIME?: string
  readonly VITE_ENABLE_PIP?: string
  readonly VITE_ENABLE_QA_LAB?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
