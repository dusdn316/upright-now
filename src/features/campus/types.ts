/**
 * 캠퍼스 테마 · 영토전 프로토타입 타입.
 *
 * 이 모듈은 자세 엔진·캘리브레이션·보상·PiP·친구 방 코어와 완전히 분리되어 있습니다.
 * 여기에는 카메라 영상·프레임·랜드마크·자세 좌표·`bad` 상태가 절대 들어오지 않습니다.
 * (docs/CAMPUS_DATA_MODEL.md §5)
 */

/** 일반적인 배경 패턴 프리셋 — 학교 공식 로고·마스코트를 쓰지 않습니다. */
export type CampusPatternId = 'grid' | 'arch' | 'stripe' | 'dots' | 'weave'

/** 가상 캠퍼스 지도의 구역. 실제 학교 부지를 복제하지 않습니다. */
export type CampusZoneId =
  | 'library'
  | 'plaza'
  | 'lecture'
  | 'lawn'
  | 'cafe'
  | 'dorm'
  | 'field'
  | 'pond'

/**
 * 색 출처.
 * - `prototype-preset`: 이 프로토타입이 임의로 고른 색. 공식 색이 아닙니다.
 * - `user-defined`: 사용자가 직접 고른 색.
 */
export type CampusColorSource = 'prototype-preset' | 'user-defined'

export interface CampusSchoolPreset {
  id: string
  /** 학교 이름 (텍스트만 사용) */
  name: string
  /** 좁은 자리용 짧은 이름 */
  short: string
  /** 프로토타입 포인트 색 */
  primary: string
  /** 색 프리셋 이름 (예: 딥 네이비) */
  colorLabel: string
  pattern: CampusPatternId
  colorSource: CampusColorSource
  /** 기타 / 직접 설정 항목 */
  custom?: boolean
}

export interface CampusThemeTokens {
  schoolId: string
  schoolName: string
  short: string
  primary: string
  /** 아주 연한 배경 */
  soft: string
  /** 연한 배경 + 경계 */
  softStrong: string
  /** primary 위에 올리는 글자색 */
  onPrimary: string
  /** primary 를 조금 어둡게 — 글자 대비 확보용 */
  deep: string
  colorLabel: string
  pattern: CampusPatternId
  colorSource: CampusColorSource
}

/* --------------------------------- 시즌 ---------------------------------- */

export type CampusSeasonStatus = 'active' | 'archived'

export interface CampusSeason {
  id: string
  name: string
  startsAt: number
  endsAt: number
  status: CampusSeasonStatus
}

/* --------------------------------- 타일 ---------------------------------- */

export interface CampusTile {
  id: string
  seasonId: string
  x: number
  y: number
  zone: CampusZoneId
  ownerSchoolId: string | null
  challengerSchoolId: string | null
  defenseScore: number
  challengeScore: number
  updatedAt: number
}

export type CampusTileStatus = 'neutral' | 'held' | 'contested'

export type CampusTileEventKind = 'captured' | 'contested' | 'reinforced'

export interface CampusTileEvent {
  id: string
  seasonId: string
  tileId: string
  kind: CampusTileEventKind
  fromSchoolId: string | null
  toSchoolId: string | null
  at: number
}

/* -------------------------------- 기여도 --------------------------------- */

/**
 * 기여 이벤트 종류. 자세 점수는 쓰지 않습니다.
 * 중도 종료·데모·QA 는 기여도가 없습니다.
 */
export type CampusContributionKind =
  | 'session_completed'
  | 'posture_recovered'
  | 'friend_session_completed'
  | 'stretch_completed'

export interface CampusContributionEvent {
  eventId: string
  kind: CampusContributionKind
  seasonId: string
  schoolId: string
  /** 익명 사용자 식별자 (닉네임·이메일이 아닙니다) */
  memberId: string
  /** 세션 단위 중복 차단용. 스트레칭처럼 세션이 없으면 null */
  sessionId: string | null
  tileId: string
  points: number
  occurredAt: number
}

export interface CampusSchoolStanding {
  schoolId: string
  totalContribution: number
  activeContributors: number
  /** totalContribution / sqrt(max(activeContributors, 1)) — 규모 보정 점수 */
  normalizedScore: number
  tiles: number
}

/* ------------------------------ 저장소 스냅샷 ----------------------------- */

export interface CampusArchivedSeason {
  season: CampusSeason
  tiles: CampusTile[]
  standings: CampusSchoolStanding[]
}

export interface CampusSnapshot {
  season: CampusSeason
  tiles: CampusTile[]
  standings: CampusSchoolStanding[]
  /** 최근 → 과거 순 */
  tileEvents: CampusTileEvent[]
  /** 이번 시즌 내 기여도 */
  myContribution: number
  archived: CampusArchivedSeason[]
}
