import { expect, test, type Page } from '@playwright/test'
import { dev } from './dev-api'

/**
 * 캐릭터 이미지 에셋 적용 확인 + 스크린샷.
 * 실제 카메라 없이 window.__upright 로 상태를 만듭니다.
 */
const DIR = 'artifacts/character-assets'

test.use({ viewport: { width: 1440, height: 1000 } })

async function assetState(page: Page): Promise<string | null> {
  return page
    .locator('figure[data-asset-state]')
    .first()
    .getAttribute('data-asset-state')
}

async function startSession(page: Page) {
  await page.goto('/session/demo?demo=1')
  await dev(page, 'startSession', 'demo')
  await dev(page, 'setStage', 3)
  await page.waitForTimeout(300)
}

test('대시보드 Lv.3 캐릭터 이미지', async ({ page }) => {
  await page.goto('/?demo=1')
  await page.waitForTimeout(400)

  const hero = page.locator('main figure[data-asset-state] img').first()
  await expect(hero).toHaveAttribute('src', /stage-03\/idle\.webp/)
  await expect(hero).toHaveAttribute('alt', /Lv\.3 빼꼼 거부기린/)

  await page.screenshot({ path: `${DIR}/dashboard-stage-03.png`, fullPage: true })
})

test('성장 화면 6단계 실제 이미지', async ({ page }) => {
  await page.goto('/growth?demo=1')
  await page.waitForTimeout(400)

  // 타임라인 6칸 모두 이미지가 붙어 있어야 합니다.
  const imgs = page.locator('ol[aria-label="캐릭터 6단계 성장"] img')
  await expect(imgs).toHaveCount(6)
  for (let i = 1; i <= 6; i += 1) {
    await expect(
      page.locator(`ol img[src*="stage-0${i}/idle.webp"]`).first(),
    ).toBeVisible()
  }

  await page.screenshot({ path: `${DIR}/growth-all-stages.png`, fullPage: true })
})

test('세션 자세 상태별 이미지 매핑', async ({ page }) => {
  await startSession(page)

  // good → idle
  await dev(page, 'setPosture', 'good')
  await expect
    .poll(() => assetState(page))
    .toBe('idle')
  await page.screenshot({ path: `${DIR}/session-idle.png`, fullPage: true })

  // warning → warning
  await dev(page, 'setPosture', 'warning')
  await expect.poll(() => assetState(page)).toBe('warning')
  await page.screenshot({ path: `${DIR}/session-warning.png`, fullPage: true })

  // bad → slouch
  await dev(page, 'setPosture', 'bad')
  await expect.poll(() => assetState(page)).toBe('slouch')
  await page.screenshot({ path: `${DIR}/session-slouch.png`, fullPage: true })

  // 회복 중 → recover
  await dev(page, 'showRecovering')
  await expect.poll(() => assetState(page)).toBe('recover')
  await page.screenshot({ path: `${DIR}/session-recover.png`, fullPage: true })

  // 회복 성공 → attack (짧게) → idle
  await dev(page, 'setPosture', 'bad')
  await dev(page, 'startRecovery')
  await dev(page, 'recoverySuccess')
  await expect.poll(() => assetState(page)).toBe('attack')
  await page.screenshot({ path: `${DIR}/session-attack.png`, fullPage: true })

  // 공격 연출이 끝나면 idle 로 복귀
  await expect.poll(() => assetState(page), { timeout: 3000 }).toBe('idle')
})

test('이미지 로딩 실패 시 SVG 폴백', async ({ page }) => {
  await startSession(page)
  await dev(page, 'setImagesBroken', true)
  await dev(page, 'setPosture', 'bad')

  const figure = page.locator('main figure[data-asset-state]').first()
  await expect(figure).toHaveAttribute('data-asset-state', 'svg-fallback')
  await expect(figure.locator('svg')).toBeVisible()
  await expect(figure.locator('img')).toHaveCount(0)

  await page.screenshot({ path: `${DIR}/image-fallback.png`, fullPage: true })
})
