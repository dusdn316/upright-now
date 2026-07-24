/**
 * 버전이 포함된 localStorage 저장소.
 *
 * 온디바이스 원칙: 영상·프레임·랜드마크 원본·얼굴 이미지는 절대 넣지 않습니다.
 * 여기에는 요약 지표와 진행 상태만 저장합니다. (docs/14 §2)
 */
const NAMESPACE = 'upright-now'
const SCHEMA_VERSION = 1

interface Envelope<T> {
  v: number
  data: T
}

function key(name: string): string {
  return `${NAMESPACE}:${name}`
}

export function loadLocal<T>(name: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key(name))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Envelope<T>
    if (parsed.v !== SCHEMA_VERSION) return fallback
    return parsed.data
  } catch {
    return fallback
  }
}

export function saveLocal<T>(name: string, data: T): void {
  if (typeof localStorage === 'undefined') return
  try {
    const envelope: Envelope<T> = { v: SCHEMA_VERSION, data }
    localStorage.setItem(key(name), JSON.stringify(envelope))
  } catch {
    // 저장 실패는 조용히 넘어갑니다. 화면 값은 메모리에 유지됩니다.
  }
}

export function clearLocal(): void {
  if (typeof localStorage === 'undefined') return
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    if (k && k.startsWith(`${NAMESPACE}:`)) toRemove.push(k)
  }
  for (const k of toRemove) localStorage.removeItem(k)
}

export const STORAGE_KEYS = {
  user: 'user',
  progression: 'progression',
  calibration: 'calibration',
  sessions: 'sessions',
} as const
