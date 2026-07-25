import { expect, test, type Page } from '@playwright/test'
import { dev } from './dev-api'

/**
 * Phase 1.6 화면 캡처.
 * 실제 카메라·MediaPipe 는 연결하지 않고 window.__upright 로만 상태를 만듭니다.
 */
const DIR = 'artifacts/phase-1-6-screens'

const WIDE = { width: 1440, height: 1000 }
const NARROW = { width: 1280, height: 800 }

async function settle(page: Page, ms = 350) {
  await page.waitForTimeout(ms)
}

/** 세션 화면을 실제로 진행 중인 상태로 만듭니다. */
async function startSession(page: Page) {
  await page.goto('/session/demo?demo=1')
  await dev(page, 'startSession', 'demo')
  await page.waitForTimeout(1200)
}

test.describe('1440x1000', () => {
  test.use({ viewport: WIDE })

  test('01 대시보드', async ({ page }) => {
    await page.goto('/?demo=1')

    await expect(page.getByRole('radio', { name: /25분 집중/ })).toBeChecked()
    await expect(page.getByText('Lv.3 빼꼼 거부기린').first()).toBeVisible()

    await settle(page)
    await page.screenshot({ path: `${DIR}/01-dashboard-1440.png`, fullPage: true })
  })

  test('02 카메라 안내', async ({ page }) => {
    await page.goto('/camera')

    const cameraOn = process.env.VITE_ENABLE_CAMERA === 'true'
    if (cameraOn) {
      // 카메라 플래그 ON: 연결 버튼과 데모 버튼이 함께 보입니다.
      await expect(
        page.getByRole('button', { name: '카메라 연결하기' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: '카메라 없이 3분 데모' }),
      ).toBeVisible()
    } else {
      // 카메라 플래그 OFF: 데모가 주 CTA 입니다.
      await expect(
        page.getByRole('button', { name: '카메라 없이 3분 데모' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: '카메라 연결하기' }),
      ).toHaveCount(0)
      await expect(
        page.getByText(
          '현재 데모에서는 카메라 없이 자세 상태와 게임 흐름을 체험할 수 있어요.',
        ),
      ).toBeVisible()
    }

    await settle(page)
    await page.screenshot({ path: `${DIR}/02-camera-1440.png`, fullPage: true })
  })

  test('03~06 세션 상태와 결과', async ({ page }) => {
    await startSession(page)

    const boss = page.getByRole('progressbar', { name: /북몽이/ })

    // 03 good
    await dev(page, 'setPosture', 'good')
    await expect(page.getByText('편안한 기준에 가까워요.')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${DIR}/03-session-good-1440.png`, fullPage: true })

    // 메인 콘텐츠(보스 체력바까지)가 화면 상단 70% 안에 들어와야 합니다.
    const bossBox = await boss.boundingBox()
    expect(bossBox).not.toBeNull()
    expect(bossBox!.y + bossBox!.height).toBeLessThanOrEqual(WIDE.height * 0.7)

    // 04 bad — 움츠린 캐릭터(slouch 이미지) + 코랄 카드
    await dev(page, 'setPosture', 'bad')
    await expect(
      page.getByText('처음 등록한 기준으로 가볍게 돌아와 볼까요?'),
    ).toBeVisible()
    await expect(
      page.locator('main figure[data-asset-state="slouch"]'),
    ).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${DIR}/04-session-bad-1440.png`, fullPage: true })

    // 05 recovery success — 에너지 효과·HP·콤보·XP·토스트
    await dev(page, 'startRecovery')
    await dev(page, 'recoverySuccess')

    await expect(boss).toHaveAttribute('value', '96')
    await expect(page.getByTestId('recovery-effect')).toBeVisible()
    await expect(
      page.getByText('자세를 회복했어요! 회복 에너지 발사!'),
    ).toBeVisible()
    await expect(page.getByText('최고 콤보 1회')).toBeVisible()
    await page.screenshot({
      path: `${DIR}/05-session-recovery-1440.png`,
      fullPage: true,
    })

    // 06 결과 — 정상 완료 상태에서 캡처
    await dev(page, 'completeSession')
    await page.getByRole('button', { name: '결과 보기' }).click()
    await expect(page.getByText('자세 요약')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${DIR}/06-result-1440.png`, fullPage: true })
  })
})

test.describe('1280x800', () => {
  test.use({ viewport: NARROW })

  test('07 대시보드', async ({ page }) => {
    await page.goto('/?demo=1')
    await settle(page)
    await page.screenshot({ path: `${DIR}/07-dashboard-1280.png`, fullPage: true })
  })

  test('08 집중 세션', async ({ page }) => {
    await startSession(page)
    await dev(page, 'setPosture', 'good')
    await settle(page)
    await page.screenshot({ path: `${DIR}/08-session-1280.png`, fullPage: true })
  })

  test('09 결과', async ({ page }) => {
    await startSession(page)
    await dev(page, 'startRecovery')
    await dev(page, 'recoverySuccess')
    await dev(page, 'completeSession')
    await page.getByRole('button', { name: '결과 보기' }).click()
    await expect(page.getByText('자세 요약')).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${DIR}/09-result-1280.png`, fullPage: true })
  })
})
