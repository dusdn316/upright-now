import type { CampusSeason } from './types'

/**
 * 시즌 — 14일 고정 길이.
 *
 * 프로토타입에서는 서버 없이도 "시즌 남은 시간"과 "시즌 종료 → 초기화"를
 * 확인할 수 있도록, 고정 기준 시각에서 시즌 번호를 계산합니다.
 * 실제 Supabase 로 바꿀 때는 `campus_seasons` 행이 이 함수를 대체합니다.
 */
export const SEASON_LENGTH_MS = 14 * 24 * 60 * 60 * 1000

/** 시즌 1의 시작 (UTC) */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5)

export function seasonIndexAt(now: number): number {
  return Math.max(0, Math.floor((now - SEASON_EPOCH) / SEASON_LENGTH_MS))
}

export function seasonAt(now: number): CampusSeason {
  const index = seasonIndexAt(now)
  const startsAt = SEASON_EPOCH + index * SEASON_LENGTH_MS
  return {
    id: `season-${index + 1}`,
    name: `시즌 ${index + 1}`,
    startsAt,
    endsAt: startsAt + SEASON_LENGTH_MS,
    status: 'active',
  }
}

export function seasonRemainingMs(season: CampusSeason, now: number): number {
  return Math.max(0, season.endsAt - now)
}

/** `3일 4시간` 형태 — 초 단위까지 내려가지 않게 해서 불필요한 리렌더를 줄입니다. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '종료'
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}일 ${hours}시간`
  if (hours > 0) return `${hours}시간 ${minutes}분`
  return `${minutes}분`
}

export function formatSeasonRange(season: CampusSeason): string {
  const fmt = (value: number) =>
    new Date(value).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  return `${fmt(season.startsAt)} ~ ${fmt(season.endsAt)}`
}
