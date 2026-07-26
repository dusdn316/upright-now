import { expect, test, type Page } from '@playwright/test'
import {
  CAMPUS_BASE,
  CAMPUS_ROUTES,
  campusState,
  contribute,
  gotoCampus,
  selectSchool,
  setTargetTile,
} from './campus-base'
import { dev } from './dev-api'

/**
 * 캠퍼스 테마 · 영토전 프로토타입 E2E.
 *
 * 이 spec 은 캠퍼스 플래그가 켜진 dev 서버(5274)를 씁니다.
 * 기본 서버(5273)는 플래그 OFF 회귀 검사용이며 campus-off.spec.ts 가 담당합니다.
 */
async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.documentElement
    return el.scrollWidth - el.clientWidth > 1
  })
}

async function resetCampusStorage(page: Page): Promise<void> {
  await gotoCampus(page, '/campus')
  await page.evaluate(() => {
    localStorage.clear()
  })
}

test.describe('캠퍼스 주소', () => {
  for (const path of CAMPUS_ROUTES) {
    test(`${path} — 직접 접근·새로고침에서 404 가 없고 주소가 유지된다`, async ({ page }) => {
      const first = await gotoCampus(page, path)
      expect(first?.status(), `${path} 최초 진입`).toBeLessThan(400)
      await expect(page.locator('#root')).not.toBeEmpty()

      const reloaded = await page.reload()
      expect(reloaded?.status(), `${path} 새로고침`).toBeLessThan(400)
      await expect(page.locator('#root')).not.toBeEmpty()
      expect(new URL(page.url()).pathname).toBe(path)
    })
  }

  test('뒤로가기로 캠퍼스 화면 사이를 오갈 수 있다', async ({ page }) => {
    await gotoCampus(page, '/campus')
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus/map')
    await expect(page.getByTestId('territory-map')).toBeVisible()

    await page.goBack()
    expect(new URL(page.url()).pathname).toBe('/campus')

    await page.goForward()
    expect(new URL(page.url()).pathname).toBe('/campus/map')
    await expect(page.getByTestId('territory-map')).toBeVisible()
  })
})

test.describe('캠퍼스 화면', () => {
  test('학교를 고르면 지도 96칸과 시즌·기여도가 보인다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')

    await expect(page.getByTestId('territory-map')).toBeVisible()
    await expect(page.getByTestId('territory-tile')).toHaveCount(96)
    await expect(page.getByText('내 학교', { exact: true })).toBeVisible()
    await expect(page.getByText('점령 타일 수', { exact: true })).toBeVisible()
    await expect(page.getByText('내 기여도', { exact: true })).toBeVisible()
    await expect(page.getByTestId('campus-unofficial-notice').first()).toBeVisible()
  })

  test('설정에 비공식 캠퍼스 테마 고지 문구가 그대로 보인다', async ({ page }) => {
    await page.goto(`${CAMPUS_BASE}/settings`)
    await expect(page.getByTestId('campus-unofficial-line')).toHaveText(
      '사용자가 직접 선택한 비공식 캠퍼스 테마입니다.',
    )
    await expect(page.getByRole('radio', { name: /서울대학교/ })).toBeVisible()
  })

  test('공식 대항전·공식 순위처럼 읽히는 문구가 없다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')
    await expect(page.getByTestId('territory-map')).toBeVisible()

    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
    for (const banned of [
      '공식 대항전이에요',
      '공식 대항전입니다',
      '공식 순위예요',
      '공식 순위입니다',
      '공식 색상이에요',
      '공식 색상입니다',
      '대학 인증 완료',
    ]) {
      expect(text, `금지 문구: ${banned}`).not.toContain(banned)
    }
    expect(text).toContain('비공식')
  })

  test('사이드바 캠퍼스 메뉴와 대시보드 캠퍼스 카드가 있다', async ({ page }) => {
    await page.goto(`${CAMPUS_BASE}/`)
    await expect(page.getByRole('link', { name: '캠퍼스' })).toBeVisible()
    await expect(page.getByTestId('campus-dashboard-card')).toBeVisible()
  })
})

test.describe('기여도와 점령', () => {
  test('세션 정상 완료가 기여도 100점으로 반영된다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')

    // 실제 앱 경로: 세션 시작 → 정상 완료 → 브리지가 기여도를 기록
    await dev(page, 'startSession', 'e2e-campus-1')
    await dev(page, 'completeSession')

    await expect
      .poll(async () => (await campusState(page)).myContribution, { timeout: 5000 })
      .toBe(100)
  })

  test('완료되지 않은 세션은 기여도가 없다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')

    // 세션을 시작만 하고 완료하지 않습니다. (중도 종료와 같은 상태)
    await dev(page, 'startSession', 'e2e-aborted')
    await page.waitForTimeout(500)
    expect((await campusState(page)).myContribution).toBe(0)

    // 다른 화면으로 나갔다 돌아와도 기여도는 0 입니다.
    await gotoCampus(page, '/campus/map')
    await gotoCampus(page, '/campus')
    expect((await campusState(page)).myContribution).toBe(0)
  })

  test('데모(?demo=1) 세션은 기여도가 없다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await page.goto(`${CAMPUS_BASE}/campus?demo=1`)

    await dev(page, 'startSession', 'e2e-demo')
    await dev(page, 'completeSession')

    expect((await campusState(page)).myContribution).toBe(0)
  })

  test('같은 eventId 는 두 번 반영되지 않는다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')

    const first = await contribute(page, 'session_completed', 'dup-1', 'dup-session')
    const second = await contribute(page, 'session_completed', 'dup-1', 'dup-session')

    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(false)
    expect(second.reason).toBe('duplicate_event')
    expect((await campusState(page)).myContribution).toBe(100)
  })

  test('두 브라우저 탭이 실시간(mock)으로 같은 점령을 본다', async ({ page, context }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus/map')
    await expect(page.getByTestId('territory-map')).toBeVisible()

    // 방어 점수가 가장 낮은 잔디밭 중립 타일을 고릅니다. (120점)
    const targetId = await page
      .locator('[data-testid="territory-tile"][data-owner="none"][data-zone="lawn"][data-challenger="none"]')
      .first()
      .getAttribute('data-tile-id')
    expect(targetId).not.toBeNull()

    const other = await context.newPage()
    await other.goto(`${CAMPUS_BASE}/campus/map`)
    await expect(other.getByTestId('territory-map')).toBeVisible()

    await setTargetTile(other, targetId!)
    await contribute(other, 'session_completed', 'sync-1', 'sync-session-1')
    const capture = await contribute(other, 'session_completed', 'sync-2', 'sync-session-2')
    expect(capture.accepted).toBe(true)

    // 첫 번째 탭이 새로고침 없이 점령을 반영해야 합니다.
    await expect(
      page.locator(`[data-testid="territory-tile"][data-tile-id="${targetId}"]`),
    ).toHaveAttribute('data-owner', 'snu', { timeout: 5000 })

    await other.close()
  })

  test('회복 기여는 세션당 상한을 넘지 않는다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')

    let accepted = 0
    for (let i = 0; i < 8; i += 1) {
      const result = await contribute(page, 'posture_recovered', `rec-${i}`, 'rec-session')
      if (result.accepted) accepted += 1
    }
    // 20초 최소 간격 때문에 실제로는 1회만 통과합니다. (상한 5회를 넘지 않음)
    expect(accepted).toBeGreaterThanOrEqual(1)
    expect(accepted).toBeLessThanOrEqual(5)
  })
})

test.describe('캠퍼스 개인정보', () => {
  test('저장된 캠퍼스 데이터에 카메라·랜드마크·자세 좌표가 0건이다', async ({ page }) => {
    await resetCampusStorage(page)
    await selectSchool(page, 'snu')
    await gotoCampus(page, '/campus')
    await contribute(page, 'session_completed', 'privacy-1', 'privacy-session')

    const dump = await page.evaluate(() => {
      const out: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key && key.includes('campus')) out[key] = localStorage.getItem(key) ?? ''
      }
      return out
    })

    const raw = JSON.stringify(dump).toLowerCase()
    expect(Object.keys(dump).length).toBeGreaterThan(0)
    for (const forbidden of [
      'landmark',
      'camera',
      'frame',
      'video',
      'cva',
      'deviation',
      'slouch',
      'posturestate',
      'badms',
      'awayms',
      'keypoint',
    ]) {
      expect(raw, `금지 키: ${forbidden}`).not.toContain(forbidden)
    }
  })
})

test.describe('캠퍼스 레이아웃', () => {
  for (const viewport of [
    { name: '1440x1000', width: 1440, height: 1000 },
    { name: '1280x800', width: 1280, height: 800 },
    // 좁은 폭 상한 검사. 640px 미만은 AppShell 의 고정 사이드바(232px) 때문에
    // 캠퍼스 이전부터 가로 스크롤이 남아 있어 이 프로토타입 범위에서 다루지 않습니다.
    // (docs/CAMPUS_QA_CHECKLIST.md §5)
    { name: '768x1024 (좁은 폭)', width: 768, height: 1024 },
  ]) {
    test(`${viewport.name} — 캠퍼스 화면에 가로 스크롤이 없다`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await resetCampusStorage(page)
      await selectSchool(page, 'snu')

      for (const path of [...CAMPUS_ROUTES, '/settings', '/']) {
        await gotoCampus(page, path)
        await expect(page.locator('#root')).not.toBeEmpty()
        expect(await hasHorizontalScroll(page), `${path} @ ${viewport.name}`).toBe(false)
      }
    })
  }
})
