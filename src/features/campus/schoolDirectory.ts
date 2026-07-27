import { getSchoolPreset } from '@/constants/campus'
import { CUSTOM_DEFAULT_COLOR } from '@/constants/campus'
import { normalizeHexColor } from './theme'
import { useCampusThemeStore } from './campusThemeStore'
import { useCampusDirectoryStore } from './directoryStore'
import type { CampusSchoolDirectoryEntry } from './types'

export { useCampusDirectoryStore } from './directoryStore'

/**
 * 학교 표시 정보의 단일 해석기.
 *
 * 모든 화면(배지·범례·순위·영토 상세·카드·공유·상점 테마)은 이 모듈로만
 * 학교 이름·짧은 이름·색을 해석합니다. 해석 순서:
 *   1) 서버 디렉터리 (campus_school_directory_entries — 모든 사용자 공통)
 *   2) 프리셋 상수
 *   3) 현재 사용자의 로컬 커스텀 입력 (서버 반영 전 잠깐)
 *   4) 안전한 "알 수 없는 학교" 폴백
 * stable key(custom-xxxx)나 "직접 설정" 같은 내부 표기는 화면에 노출하지
 * 않습니다. created_by 는 서버가 아예 보내지 않습니다.
 */
export interface SchoolIdentity {
  id: string
  displayName: string
  shortName: string
  color: string
  isCustom: boolean
  /** 폴백 여부 — 화면이 '알 수 없는 학교' 상태를 구분하고 싶을 때 */
  resolved: 'directory' | 'preset' | 'local' | 'unknown'
}

const UNKNOWN_NAME = '알 수 없는 학교'
const UNKNOWN_SHORT = '미확인'

/** 순수 해석 함수 — 테스트 가능하도록 스토어와 분리 */
export function resolveSchoolIdentity(
  schoolId: string | null | undefined,
  directory: Record<string, CampusSchoolDirectoryEntry>,
  local?: {
    schoolId: string | null
    customSchoolName: string
    customSchoolShortName: string
    customColor: string
  },
): SchoolIdentity | null {
  if (!schoolId) return null

  const entry = directory[schoolId]
  if (entry && entry.displayName.trim().length >= 2) {
    return {
      id: schoolId,
      displayName: entry.displayName,
      shortName: entry.shortName || entry.displayName.slice(0, 8),
      color: normalizeHexColor(entry.color) ?? CUSTOM_DEFAULT_COLOR,
      isCustom: entry.isCustom,
      resolved: 'directory',
    }
  }

  const preset = getSchoolPreset(schoolId)
  if (preset && !preset.custom) {
    return {
      id: schoolId,
      displayName: preset.name,
      shortName: preset.short,
      color: preset.primary,
      isCustom: false,
      resolved: 'preset',
    }
  }

  // 내가 방금 입력한(아직 서버 미반영) 커스텀 학교
  if (
    local &&
    schoolId === local.schoolId &&
    schoolId.startsWith('custom') &&
    local.customSchoolName.trim().length >= 2
  ) {
    return {
      id: schoolId,
      displayName: local.customSchoolName,
      shortName:
        local.customSchoolShortName.trim().length >= 2
          ? local.customSchoolShortName
          : local.customSchoolName.slice(0, 8),
      color: normalizeHexColor(local.customColor) ?? CUSTOM_DEFAULT_COLOR,
      isCustom: true,
      resolved: 'local',
    }
  }

  return {
    id: schoolId,
    displayName: UNKNOWN_NAME,
    shortName: UNKNOWN_SHORT,
    color: '#9AA0A6',
    isCustom: schoolId.startsWith('custom'),
    resolved: 'unknown',
  }
}

/** React 훅 — 화면 공용. 학교 id → 표시 정보 */
export function useSchoolIdentity(): (schoolId: string | null | undefined) => SchoolIdentity | null {
  const entries = useCampusDirectoryStore((s) => s.entries)
  const localSchoolId = useCampusThemeStore((s) => s.schoolId)
  const customSchoolName = useCampusThemeStore((s) => s.customSchoolName)
  const customSchoolShortName = useCampusThemeStore((s) => s.customSchoolShortName)
  const customColor = useCampusThemeStore((s) => s.customColor)
  return (schoolId) =>
    resolveSchoolIdentity(schoolId, entries, {
      schoolId: localSchoolId,
      customSchoolName,
      customSchoolShortName,
      customColor,
    })
}

/** 비 React 코드용 스냅샷 해석 */
export function resolveSchoolIdentityNow(
  schoolId: string | null | undefined,
): SchoolIdentity | null {
  const theme = useCampusThemeStore.getState()
  return resolveSchoolIdentity(schoolId, useCampusDirectoryStore.getState().entries, {
    schoolId: theme.schoolId,
    customSchoolName: theme.customSchoolName,
    customSchoolShortName: theme.customSchoolShortName,
    customColor: theme.customColor,
  })
}

/** 등록된 커스텀 학교 목록 (검색용, id 중복 없음) */
export function listRegisteredCustomSchools(
  entries: Record<string, CampusSchoolDirectoryEntry>,
): CampusSchoolDirectoryEntry[] {
  return Object.values(entries)
    .filter((e) => e.isCustom)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'))
}
