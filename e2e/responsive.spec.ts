import { expect, test, type Page } from '@playwright/test'
import { dev } from './dev-api'

/**
 * 1440x1000 과 1280x800 에서 핵심 화면이 잘리지 않는지 검사합니다.
 */
const VIEWPORTS = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
]

const PAGES = ['/', '/profiles', '/camera', '/session/setup', '/session/demo', '/result/demo']

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.documentElement
    // 1px 정도의 반올림 오차는 무시합니다.
    return el.scrollWidth - el.clientWidth > 1
  })
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const path of PAGES) {
      test(`${path} — 가로 스크롤이 없다`, async ({ page }) => {
        await page.goto(`${path}?demo=1`)
        expect(await hasHorizontalScroll(page)).toBe(false)
      })
    }

    test('세션 화면의 타이머·캐릭터·보스 체력이 잘리지 않는다', async ({ page }) => {
      await page.goto('/session/demo?demo=1')
      await dev(page, 'startSession', 'demo')
      await dev(page, 'setPosture', 'good')

      await dev(page, 'setStage', 3)
      const boss = page.getByRole('progressbar', { name: /북몽이/ })
      const character = page.locator('main figure[data-asset-state]').first()
      const timer = page.getByText('남은 시간')

      for (const target of [boss, character, timer]) {
        const box = await target.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
      }

      expect(await hasHorizontalScroll(page)).toBe(false)
    })

    test('대시보드의 주 CTA 가 화면 안에 있다', async ({ page }) => {
      await page.goto('/?demo=1')

      const cta = page.getByRole('button', { name: /지금 집중 시작/ })
      const box = await cta.boundingBox()

      expect(box).not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
    })
  })
}
