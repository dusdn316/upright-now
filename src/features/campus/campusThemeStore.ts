import { create } from 'zustand'
import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { useDemoStore } from '@/features/demo/demoMode'
import { CUSTOM_DEFAULT_COLOR } from '@/constants/campus'
import { normalizeHexColor, resolveCampusTheme } from './theme'
import { seasonAt } from './season'
import {
  applySchoolChange,
  canChangeSchool,
  type SchoolChangeDecision,
  type SchoolChangeHistory,
} from './schoolChange'
import type { CampusThemeTokens } from './types'

/**
 * 캠퍼스 테마 선택 상태.
 *
 * 학교·직접 고른 색·변경 이력만 저장합니다.
 * 자세·카메라 관련 값은 여기에 들어오지 않습니다.
 */
interface CampusThemePersisted {
  schoolId: string | null
  customColor: string
  /** 기타/직접 설정 학교의 표시 이름 (2~30자, sanitize 후 저장) */
  customSchoolName: string
  /** 배지 등 짧은 표기 (2~8자) */
  customSchoolShortName: string
  lastChangedAt: number | null
  lastChangedSeasonId: string | null
  changesInSeason: number
  /** 지도에서 고른 기여 대상 타일 */
  targetTileId: string | null
}

interface CampusThemeState extends CampusThemePersisted {
  /** 학교를 고르거나 바꿉니다. 제한에 걸리면 상태를 바꾸지 않습니다. */
  selectSchool: (schoolId: string, now?: number) => SchoolChangeDecision
  /** 기타 / 직접 설정의 색만 바꿉니다. 학교 변경 제한과 무관합니다. */
  setCustomColor: (color: string) => boolean
  /** 기타 학교 이름 설정 — sanitize 후 저장. 학교 변경 제한과 무관 */
  setCustomSchoolName: (name: string, shortName: string) => void
  setTargetTile: (tileId: string | null) => void
  /** 지금 학교를 바꿀 수 있는지 미리 확인합니다. */
  checkChange: (schoolId: string, now?: number) => SchoolChangeDecision
  reset: () => void
}

const initialState: CampusThemePersisted = {
  schoolId: null,
  customColor: CUSTOM_DEFAULT_COLOR,
  customSchoolName: '',
  customSchoolShortName: '',
  lastChangedAt: null,
  lastChangedSeasonId: null,
  changesInSeason: 0,
  targetTileId: null,
}

const persisted = loadLocal<CampusThemePersisted>(STORAGE_KEYS.campus, initialState)

function persist(state: CampusThemePersisted): void {
  // 데모 값이 실제 설정으로 새지 않게 합니다. (persist.ts 와 같은 규칙)
  if (useDemoStore.getState().isDemo) return
  saveLocal(STORAGE_KEYS.campus, {
    schoolId: state.schoolId,
    customColor: state.customColor,
    customSchoolName: state.customSchoolName,
    customSchoolShortName: state.customSchoolShortName,
    lastChangedAt: state.lastChangedAt,
    lastChangedSeasonId: state.lastChangedSeasonId,
    changesInSeason: state.changesInSeason,
    targetTileId: state.targetTileId,
  })
}

function historyOf(state: CampusThemePersisted): SchoolChangeHistory {
  return {
    schoolId: state.schoolId,
    lastChangedAt: state.lastChangedAt,
    lastChangedSeasonId: state.lastChangedSeasonId,
    changesInSeason: state.changesInSeason,
  }
}

export const useCampusThemeStore = create<CampusThemeState>((set, get) => ({
  ...initialState,
  ...persisted,
  // 구버전 저장분 가드 — 신규 필드 undefined 방지
  customSchoolName: persisted.customSchoolName ?? '',
  customSchoolShortName: persisted.customSchoolShortName ?? '',

  checkChange: (schoolId, now = Date.now()) => {
    const season = seasonAt(now)
    return canChangeSchool(
      {
        history: historyOf(get()),
        seasonId: season.id,
        seasonEndsAt: season.endsAt,
        now,
      },
      schoolId,
    )
  },

  selectSchool: (schoolId, now = Date.now()) => {
    const decision = get().checkChange(schoolId, now)
    if (!decision.allowed) return decision

    const season = seasonAt(now)
    const nextHistory = applySchoolChange(historyOf(get()), schoolId, season.id, now)
    const next: CampusThemePersisted = {
      ...get(),
      schoolId: nextHistory.schoolId,
      lastChangedAt: nextHistory.lastChangedAt,
      lastChangedSeasonId: nextHistory.lastChangedSeasonId,
      changesInSeason: nextHistory.changesInSeason,
      // 학교가 바뀌면 이전 학교에서 고른 대상 타일도 버립니다.
      targetTileId: null,
    }
    set(next)
    persist(next)
    /*
      Supabase 저장소가 켜져 있으면 서버 membership 도 동기화합니다.
      기여 위조 방지의 최종 판정은 서버(select_campus_school + memberships)가
      담당하고, 여기 로컬 제한은 UX 안내용입니다. (순환 import 방지: 동적 로드)
    */
    void import('./campusStore').then((m) => m.syncSchoolSelection(schoolId))
    return decision
  },

  setCustomSchoolName: (name, shortName) => {
    const next = {
      ...get(),
      customSchoolName: sanitizeSchoolName(name, 30),
      customSchoolShortName: sanitizeSchoolName(shortName, 8),
    }
    persist(next)
    set({
      customSchoolName: next.customSchoolName,
      customSchoolShortName: next.customSchoolShortName,
    })
  },

  setCustomColor: (color) => {
    const normalized = normalizeHexColor(color)
    if (!normalized) return false
    const next = { ...get(), customColor: normalized }
    set({ customColor: normalized })
    persist(next)
    return true
  },

  setTargetTile: (tileId) => {
    const next = { ...get(), targetTileId: tileId }
    set({ targetTileId: tileId })
    persist(next)
  },

  reset: () => {
    set(initialState)
    persist(initialState)
  },
}))

/** 현재 선택에서 파생된 테마 토큰. 학교를 고르지 않았으면 null. */
export function selectCampusTheme(state: CampusThemeState): CampusThemeTokens | null {
  return resolveCampusTheme(state.schoolId, state.customColor)
}

export function useCampusTheme(): CampusThemeTokens | null {
  const schoolId = useCampusThemeStore((s) => s.schoolId)
  const customColor = useCampusThemeStore((s) => s.customColor)
  return resolveCampusTheme(schoolId, customColor)
}

/** 학교 이름 정리 — HTML 태그·제어문자 제거 */
export function sanitizeSchoolName(raw: string, max: number): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * 커스텀 학교의 안정 내부 key — 표시 이름과 분리됩니다.
 * 같은 이름(정규화 기준)은 항상 같은 key 가 됩니다. (djb2 해시)
 */
export function customSchoolStableKey(name: string): string {
  const normalized = sanitizeSchoolName(name, 30)
    .toLowerCase()
    .replace(/\s+/g, '')
  let hash = 5381
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0
  }
  return `custom-${(hash >>> 0).toString(16)}`
}

/** 화면 표시용 학교 이름 — 커스텀이면 사용자가 입력한 이름 */
export function displaySchoolName(
  schoolId: string | null,
  presetName: string | undefined,
  customName: string,
): string {
  if (schoolId === 'custom') return customName || '직접 설정 학교'
  return presetName ?? '미선택'
}
