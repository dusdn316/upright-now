/**
 * 버전이 포함된 localStorage 저장소.
 *
 * 온디바이스 원칙: 영상·프레임·랜드마크 원본·얼굴 이미지는 절대 넣지 않습니다.
 * 여기에는 요약 지표와 진행 상태만 저장합니다. (docs/14 §2)
 *
 * v1 → v2 마이그레이션:
 * - progression: 데모 시드가 남은 패턴만 초기화. 실제로 획득한 데이터는 유지.
 * - calibration: 특징 스키마가 바뀌어 v1 기준은 폐기(재등록 필요). 민감도는 유지.
 * - user: calibration 이 폐기되면 hasCalibration 도 false 로.
 */
const NAMESPACE = 'upright-now'
const SCHEMA_VERSION = 2

interface Envelope<T> {
  v: number
  data: T
}

function key(name: string): string {
  return `${NAMESPACE}:${name}`
}

export const STORAGE_KEYS = {
  user: 'user',
  progression: 'progression',
  calibration: 'calibration',
  sessions: 'sessions',
  /** 캠퍼스 테마 선택 (학교·직접 고른 색·변경 이력) */
  campus: 'campus',
  /** 캠퍼스 기여도 로컬 원장 — 중복·상한 판정용 */
  campusLedger: 'campus-ledger',
  /** 캠퍼스 영토전 mock 저장소 (Supabase 대체) */
  campusMock: 'campus-mock',
} as const

/* ------------------------------ 마이그레이션 ------------------------------ */

interface ProgressionV1 {
  xp: number
  points: number
  attendance: string[]
  completedSessions: number
  [rest: string]: unknown
}

/** 데모 시드가 실제 데이터처럼 남은 패턴인지 확인합니다. */
export function isDemoContamination(p: ProgressionV1): boolean {
  if (p.completedSessions !== 0) return false
  if (p.attendance?.length > 0) return false
  // 데모 시드 (XP 700 · 240P) 또는 세션 없이 스트레칭 보상만 남은 20/20
  return (
    (p.xp === 700 && p.points === 240) ||
    (p.xp === 20 && p.points === 20) ||
    (p.xp === 0 && p.points === 20)
  )
}

function readRaw<T>(name: string): Envelope<T> | null {
  try {
    const raw = localStorage.getItem(key(name))
    return raw ? (JSON.parse(raw) as Envelope<T>) : null
  } catch {
    return null
  }
}

function writeRaw<T>(name: string, data: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify({ v: SCHEMA_VERSION, data }))
  } catch {
    // 저장 실패는 조용히 넘어갑니다.
  }
}

let migrated = false

export function ensureMigrated(): void {
  if (migrated || typeof localStorage === 'undefined') return
  migrated = true

  // progression v1 → v2
  const prog = readRaw<ProgressionV1>(STORAGE_KEYS.progression)
  if (prog && prog.v === 1) {
    const data = prog.data
    if (isDemoContamination(data)) {
      writeRaw(STORAGE_KEYS.progression, {
        ...data,
        xp: 0,
        points: 0,
        shopUnlocked: false,
      })
    } else {
      writeRaw(STORAGE_KEYS.progression, data)
    }
  }

  // calibration v1 → v2: 특징 스키마가 바뀌어 기존 기준은 사용할 수 없습니다.
  const cal = readRaw<{ profile: unknown; sensitivity: string }>(
    STORAGE_KEYS.calibration,
  )
  let calibrationDropped = false
  if (cal && cal.v === 1) {
    calibrationDropped = cal.data.profile !== null
    writeRaw(STORAGE_KEYS.calibration, {
      profile: null,
      sensitivity: cal.data.sensitivity ?? 'default',
    })
  }

  // user v1 → v2
  const user = readRaw<{ hasCalibration?: boolean }>(STORAGE_KEYS.user)
  if (user && user.v === 1) {
    writeRaw(STORAGE_KEYS.user, {
      ...user.data,
      hasCalibration: calibrationDropped ? false : user.data.hasCalibration,
    })
  }

  // sessions v1 → v2: 요약 구조 동일, 버전만 올립니다.
  const sessions = readRaw<unknown[]>(STORAGE_KEYS.sessions)
  if (sessions && sessions.v === 1) {
    writeRaw(STORAGE_KEYS.sessions, sessions.data)
  }
}

/** 테스트 전용 — 마이그레이션을 다시 실행할 수 있게 합니다. */
export function resetMigrationForTest(): void {
  migrated = false
}

/* -------------------------------- 입출력 -------------------------------- */

export function loadLocal<T>(name: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  ensureMigrated()
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
