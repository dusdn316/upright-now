import { featureFlags } from '@/lib/feature-flags/flags'
import { recordCampusContribution } from './recordContribution'
import { useCampusThemeStore } from './campusThemeStore'
import { initCampus, useCampusStore } from './campusStore'
import type { CampusContributionKind } from './types'

/**
 * 캠퍼스 전용 E2E 조작 API.
 *
 * 사용자 화면에는 노출되지 않습니다. QA Lab 플래그와 캠퍼스 영토전 플래그가
 * 모두 켜진 빌드에서만 설치되며, 두 탭 실시간 동기화·중복 차단·점령 계산을
 * 브라우저에서 확인하는 데 씁니다.
 */
export interface UprightCampusDevApi {
  selectSchool: (schoolId: string) => { allowed: boolean; reason?: string }
  setTargetTile: (tileId: string | null) => void
  contribute: (
    kind: CampusContributionKind,
    eventId: string,
    sessionId?: string | null,
  ) => Promise<{ accepted: boolean; points: number; reason?: string }>
  getState: () => {
    source: string | null
    seasonId: string | null
    myContribution: number
    ownedTiles: number
    schoolId: string | null
  }
}

declare global {
  interface Window {
    __uprightCampus?: UprightCampusDevApi
  }
}

export function installCampusDevApi(): void {
  if (typeof window === 'undefined') return
  if (!featureFlags.qaLab || !featureFlags.campusTerritory) return

  window.__uprightCampus = {
    selectSchool: (schoolId) => {
      const decision = useCampusThemeStore.getState().selectSchool(schoolId)
      void initCampus()
      return { allowed: decision.allowed, reason: decision.reason }
    },

    setTargetTile: (tileId) => useCampusThemeStore.getState().setTargetTile(tileId),

    contribute: async (kind, eventId, sessionId = 'qa-session') => {
      const result = await recordCampusContribution({
        kind,
        eventId,
        sessionId,
        // 이 API 는 E2E 전용 주입 경로이므로 데모 가드를 통과시킵니다.
        isDemo: false,
      })
      return { accepted: result.accepted, points: result.points, reason: result.reason }
    },

    getState: () => {
      const { source, snapshot } = useCampusStore.getState()
      const schoolId = useCampusThemeStore.getState().schoolId
      return {
        source,
        seasonId: snapshot?.season.id ?? null,
        myContribution: snapshot?.myContribution ?? 0,
        ownedTiles: schoolId
          ? (snapshot?.tiles.filter((t) => t.ownerSchoolId === schoolId).length ?? 0)
          : 0,
        schoolId,
      }
    },
  }
}
