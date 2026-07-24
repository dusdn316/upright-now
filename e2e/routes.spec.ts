import { expect, test } from '@playwright/test'

/**
 * 직접 주소 접근 + 새로고침 검사.
 * 운영(Vercel)에서는 vercel.json 의 SPA rewrite 가 같은 역할을 합니다.
 */
import { ROUTES } from './app-routes'

for (const path of ROUTES) {
  test(`${path} — 직접 접근과 새로고침에서 404가 없다`, async ({ page }) => {
    const first = await page.goto(path)
    expect(first?.status(), `${path} 최초 진입`).toBeLessThan(400)
    await expect(page.locator('#root')).not.toBeEmpty()

    const reloaded = await page.reload()
    expect(reloaded?.status(), `${path} 새로고침`).toBeLessThan(400)
    await expect(page.locator('#root')).not.toBeEmpty()

    // 라우터가 홈으로 튕겨내지 않고 해당 주소를 유지해야 합니다.
    expect(new URL(page.url()).pathname).toBe(path)
  })
}

test('QA Lab 의 recovery success 가 보스 체력을 줄인다', async ({ page }) => {
  await page.goto('/lab')

  const bar = page.getByRole('progressbar', { name: /마감괴수/ })
  await expect(bar).toHaveAttribute('value', '100')

  await page.getByRole('button', { name: 'recovery success' }).click()
  await expect(bar).toHaveAttribute('value', '96')
})
