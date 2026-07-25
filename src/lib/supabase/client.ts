import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 클라이언트 — 친구 방 전용.
 * env 가 없으면 null 을 돌려주고, 개인 앱은 아무 영향 없이 동작합니다.
 * 카메라 영상·프레임·랜드마크·자세 좌표는 절대 이 클라이언트로 보내지 않습니다.
 */
let cached: SupabaseClient | null = null
let attempted = false

export function isRoomConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  )
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (cached) return cached
  if (attempted) return cached
  attempted = true

  if (!isRoomConfigured()) return null

  const { createClient } = await import('@supabase/supabase-js')
  cached = createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    (import.meta.env.VITE_SUPABASE_ANON_KEY ??
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)!,
    { auth: { persistSession: true } },
  )
  return cached
}

/** 익명 로그인 — 이메일·비밀번호를 요구하지 않습니다. */
export async function ensureAnonymousUser(): Promise<string | null> {
  const supabase = await getSupabase()
  if (!supabase) return null

  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.user) return sessionData.session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) return null
  return data.user.id
}
