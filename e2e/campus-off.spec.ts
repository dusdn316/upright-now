import { expect, test } from '@playwright/test'

/**
 * 캠퍼스 플래그 OFF 회귀 — 기본 dev 서버(5273, baseURL)를 씁니다.
 *
 * 캠퍼스 메뉴·화면·학교 선택이 어디에도 없어야 하고,
 * 기존 앱 흐름은 그대로 동작해야 합니다.
 */
test.describe('캠퍼스 플래그 OFF', () => {
  for (const path of ['/campus', '/campus/map', '/campus/history']) {
    test(`${path} — 404 없이 홈으로 되돌아간다`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBeLessThan(400)
      await expect(page.locator('#root')).not.toBeEmpty()
      expect(new URL(page.url()).pathname).toBe('/')
      await expect(page.getByTestId('territory-map')).toHaveCount(0)
    })
  }

  test('사이드바에 캠퍼스 메뉴가 없다', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: '캠퍼스' })).toHaveCount(0)
    await expect(page.getByTestId('campus-dashboard-card')).toHaveCount(0)
  })

  test('설정에 학교 선택이 없고 기존 설정 항목은 그대로다', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByTestId('campus-unofficial-line')).toHaveCount(0)
    await expect(page.getByText('학교 선택 (캠퍼스 테마)')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: '개인 자세 기준' }),
    ).toBeVisible()
  })

  test('결과 화면에 캠퍼스 테두리·학교 배지가 없다', async ({ page }) => {
    await page.goto('/result/demo?demo=1')
    await expect(page.getByTestId('campus-share-frame')).toHaveCount(0)
    await expect(page.getByTestId('campus-school-badge')).toHaveCount(0)
    await expect(page.getByText('이번에 얻은 보상')).toBeVisible()
  })

  test('캠퍼스 CSS 변수와 mock 저장소가 만들어지지 않는다', async ({ page }) => {
    await page.goto('/')
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--campus-primary'),
    )
    expect(primary).toBe('')

    const campusKeys = await page.evaluate(() => {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key && key.includes('campus')) keys.push(key)
      }
      return keys
    })
    expect(campusKeys).toEqual([])
  })

  test('캠퍼스 전용 window API 가 설치되지 않는다', async ({ page }) => {
    await page.goto('/')
    const installed = await page.evaluate(() =>
      Boolean((window as unknown as { __uprightCampus?: unknown }).__uprightCampus),
    )
    expect(installed).toBe(false)
  })
})
