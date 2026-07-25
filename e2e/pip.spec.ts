import { expect, test } from '@playwright/test'
import { dev } from './dev-api'

test.use({ viewport: { width: 1440, height: 1000 } })

/** PiP API 를 제거해 미지원 브라우저를 흉내 냅니다. */
async function forceUnsupported(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: undefined,
      configurable: true,
    })
  })
}

test('토글 OFF(기본값) → 세션 시작 시 자동 PiP·폴백 위젯이 없다', async ({ page }) => {
  await forceUnsupported(page)
  await page.goto('/session/setup?demo=1')
  await page.getByRole('button', { name: /집중 시작|데모 시작/ }).click()

  await expect(page.getByText('남은 시간')).toBeVisible()
  await expect(page.getByTestId('mini-posture-widget')).toHaveCount(0)
  await expect(
    page.getByText('작은 별도 창을 열지 못해 화면 안 미니 위젯으로 표시해요.'),
  ).toHaveCount(0)
})

test('토글 ON + 미지원 → 토스트 + 화면 안 미니 위젯, 세션은 계속', async ({ page }) => {
  await forceUnsupported(page)

  // 설정에서 토글 ON (실사용자 — localStorage 에 저장되어 다음 페이지에서도 유지)
  await page.goto('/settings')
  const toggleCard = page
    .locator('section', { hasText: '세션 시작 시 미니 위젯 자동 열기' })
    .last()
  await toggleCard.getByRole('button', { name: '꺼짐' }).click()
  await expect(toggleCard.getByRole('button', { name: '켜짐' })).toBeVisible()

  // 세션 시작 (같은 click handler 에서 PiP 시도 → 미지원 → 폴백)
  await page.goto('/session/setup?demo=1')
  await page.getByRole('button', { name: /집중 시작|데모 시작/ }).click()

  await expect(
    page.getByText('작은 별도 창을 열지 못해 화면 안 미니 위젯으로 표시해요.'),
  ).toBeVisible()
  await expect(page.getByTestId('mini-posture-widget')).toBeVisible()
  // 세션 유지
  await expect(page.getByText('남은 시간')).toBeVisible()

  // 자세 상태가 바뀌면 위젯도 즉시 갱신
  await dev(page, 'setPosture', 'bad')
  await expect(
    page
      .getByTestId('mini-posture-widget')
      .getByText('처음 등록한 기준으로 가볍게 돌아와 볼까요?'),
  ).toBeVisible()

  // 위젯 안에 카메라 video 요소가 없다
  await expect(
    page.getByTestId('mini-posture-widget').locator('video'),
  ).toHaveCount(0)

  // 세션 완료 → 위젯 자동 닫힘
  await dev(page, 'completeSession')
  await expect(page.getByTestId('mini-posture-widget')).toHaveCount(0)
})

test('새로고침 후에도 토글 상태가 유지된다', async ({ page }) => {
  await page.goto('/settings')
  const toggleCard = page
    .locator('section', { hasText: '세션 시작 시 미니 위젯 자동 열기' })
    .last()
  await toggleCard.getByRole('button', { name: '꺼짐' }).click()
  await expect(toggleCard.getByRole('button', { name: '켜짐' })).toBeVisible()

  await page.reload()
  await expect(
    page
      .locator('section', { hasText: '세션 시작 시 미니 위젯 자동 열기' })
      .last()
      .getByRole('button', { name: '켜짐' }),
  ).toBeVisible()
})

test('지원 브라우저에서 세션 시작 → PiP 창 열림 (API 있으면 실검증)', async ({ page }) => {
  await page.goto('/settings')
  const supported = await page.evaluate(
    () => 'documentPictureInPicture' in window,
  )
  test.skip(!supported, '이 브라우저 빌드에는 Document PiP API 가 없습니다')

  const toggleCard = page
    .locator('section', { hasText: '세션 시작 시 미니 위젯 자동 열기' })
    .last()
  await toggleCard.getByRole('button', { name: '꺼짐' }).click()

  await page.goto('/session/setup?demo=1')
  await page.getByRole('button', { name: /집중 시작|데모 시작/ }).click()

  // PiP 창이 실제로 열렸는지 (실패 시 폴백이 켜졌는지) 확인
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = (window as unknown as {
            __upright?: { getPipState: () => { open: boolean; fallback: boolean } }
          }).__upright
          return api ? api.getPipState() : { open: false, fallback: false }
        }),
      { timeout: 5000 },
    )
    .toMatchObject({ open: true, fallback: false })

  // 세션 완료 → PiP 자동 닫힘
  await dev(page, 'completeSession')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as unknown as {
          __upright?: { getPipState: () => { open: boolean } }
        }).__upright
        return api ? api.getPipState().open : true
      }),
    )
    .toBe(false)
})
