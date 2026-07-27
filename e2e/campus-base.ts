import type { Page } from '@playwright/test'

/**
 * 캠퍼스 플래그가 켜진 dev 서버 (playwright.config.ts 의 두 번째 webServer).
 * spec 파일이 아니므로 테스트로 수집되지 않습니다.
 */
export const CAMPUS_BASE = 'http://localhost:5284'

export const CAMPUS_ROUTES = ['/campus', '/campus/map', '/campus/history']

export interface CampusDevState {
  source: string | null
  seasonId: string | null
  myContribution: number
  ownedTiles: number
  schoolId: string | null
}

export interface CampusContributeResult {
  accepted: boolean
  points: number
  reason?: string
}

export async function gotoCampus(page: Page, path: string) {
  return page.goto(`${CAMPUS_BASE}${path}`)
}

/** 캠퍼스 전용 window API 가 붙을 때까지 기다립니다. */
export async function waitForCampusApi(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __uprightCampus?: unknown }).__uprightCampus),
  )
}

export async function selectSchool(page: Page, schoolId: string): Promise<void> {
  await waitForCampusApi(page)
  await page.evaluate((id) => {
    const api = (
      window as unknown as {
        __uprightCampus: { selectSchool: (schoolId: string) => unknown }
      }
    ).__uprightCampus
    api.selectSchool(id)
  }, schoolId)
}

export async function setTargetTile(page: Page, tileId: string): Promise<void> {
  await waitForCampusApi(page)
  await page.evaluate((id) => {
    const api = (
      window as unknown as {
        __uprightCampus: { setTargetTile: (tileId: string | null) => void }
      }
    ).__uprightCampus
    api.setTargetTile(id)
  }, tileId)
}

export async function contribute(
  page: Page,
  kind: string,
  eventId: string,
  sessionId: string | null = 'qa-session',
): Promise<CampusContributeResult> {
  await waitForCampusApi(page)
  return page.evaluate(
    async ({ kind: k, eventId: e, sessionId: s }) => {
      const api = (
        window as unknown as {
          __uprightCampus: {
            contribute: (
              kind: string,
              eventId: string,
              sessionId: string | null,
            ) => Promise<{ accepted: boolean; points: number; reason?: string }>
          }
        }
      ).__uprightCampus
      return api.contribute(k, e, s)
    },
    { kind, eventId, sessionId },
  )
}

export async function campusState(page: Page): Promise<CampusDevState> {
  await waitForCampusApi(page)
  return page.evaluate(() => {
    const api = (
      window as unknown as { __uprightCampus: { getState: () => CampusDevState } }
    ).__uprightCampus
    return api.getState()
  })
}
