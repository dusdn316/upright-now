/**
 * 세션 길이 — docs/02_PRD.md FR-006
 * 기본은 25분 집중 + 2분 회복 휴식입니다.
 * supabase/schema.sql 의 duration_seconds check(180,900,1500,3000)와 일치시킵니다.
 */
export interface SessionLengthOption {
  id: string
  label: string
  restLabel: string
  focusSec: number
  restSec: number
  isDemo?: boolean
}

export const SESSION_LENGTHS: SessionLengthOption[] = [
  { id: '25', label: '25분 집중', restLabel: '+ 2분 회복 휴식', focusSec: 1500, restSec: 120 },
  { id: '15', label: '15분 집중', restLabel: '+ 1분 회복 휴식', focusSec: 900, restSec: 60 },
  { id: '50', label: '50분 집중', restLabel: '+ 5분 회복 휴식', focusSec: 3000, restSec: 300 },
  { id: 'demo', label: '3분 데모', restLabel: '+ 1분 회복 휴식', focusSec: 180, restSec: 60, isDemo: true },
]

export const DEFAULT_SESSION_LENGTH_ID = '25'

export function getSessionLength(id: string): SessionLengthOption {
  return (
    SESSION_LENGTHS.find((option) => option.id === id) ??
    SESSION_LENGTHS[0]
  )
}

/** 출석으로 인정되는 최소 진행 시간 — docs/07 §10 */
/** 직접 설정 범위: 집중 5~120분(5분 단위) · 회복 휴식 0~30분 */
export function clampCustomFocusMin(min: number): number {
  const snapped = Math.round(min / 5) * 5
  return Math.min(120, Math.max(5, snapped))
}

export function clampCustomRestMin(min: number): number {
  const snapped = Math.round(min / 5) * 5
  return Math.min(30, Math.max(0, snapped))
}

export const ATTENDANCE_MIN_MS = 10 * 60 * 1000
