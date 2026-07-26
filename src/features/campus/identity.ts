/**
 * 캠퍼스 기여자 식별자.
 *
 * 회원가입을 요구하지 않으므로 이 브라우저에만 남는 임의 문자열을 씁니다.
 * 닉네임·이메일·기기 정보를 담지 않고, 서버(Supabase)로 갈 때는
 * 익명 사용자 id 로 대체됩니다.
 */
const KEY = 'upright-now:campus-member'

let cached: string | null = null

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `m-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function getCampusMemberId(): string {
  if (cached) return cached
  if (typeof localStorage === 'undefined') {
    cached = randomId()
    return cached
  }
  const stored = localStorage.getItem(KEY)
  if (stored) {
    cached = stored
    return stored
  }
  const created = randomId()
  try {
    localStorage.setItem(KEY, created)
  } catch {
    // 저장 실패는 조용히 넘어갑니다. 이번 세션 동안만 유지됩니다.
  }
  cached = created
  return created
}

/** 테스트 전용 */
export function resetCampusMemberIdForTest(): void {
  cached = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}
