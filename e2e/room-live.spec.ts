import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * 실제 2인 친구 방 라이브 테스트 — 두 개의 독립 브라우저 컨텍스트(별도 저장소 =
 * 별도 익명 사용자)로 방 생성→입장→준비→시작→공동 보스→기린 싱크를 검증합니다.
 *
 * Supabase env 가 없으면 자동으로 건너뜁니다.
 * 실행: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_ENABLE_FRIEND_ROOM=true
 *       를 .env.local 에 넣고 `npx playwright test e2e/room-live.spec.ts`
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const HAS_ENV = Boolean(SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)

/** Supabase 로 나가는 요청 본문에 금지 데이터가 없는지 감시합니다. */
const FORBIDDEN_PATTERN =
  /landmark|frame|snapshot|faceImage|coordinates|"bad"|badDuration|postureState|baseline|variance/i

function watchForbidden(page: Page, offenders: string[]): void {
  page.on('request', (request: Request) => {
    if (!SUPABASE_URL || !request.url().startsWith(SUPABASE_URL)) return
    const body = request.postData()
    if (body && FORBIDDEN_PATTERN.test(body)) {
      offenders.push(`${request.url()} :: ${body.slice(0, 200)}`)
    }
  })
}

test.describe('실제 2인 친구 방', () => {
  test.skip(!HAS_ENV, 'Supabase env 미설정 — .env.local 에 URL/ANON_KEY 필요')
  test.setTimeout(120_000)

  test('생성→입장→준비→시작→공동 보스→회복→기린 싱크→금지 데이터 0건', async ({
    browser,
  }) => {
    const offenders: string[] = []

    // 사용자 A (방장) — 일반 창에 해당하는 컨텍스트
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    watchForbidden(pageA, offenders)

    // 사용자 B (게스트) — 시크릿 창에 해당하는 독립 컨텍스트
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    watchForbidden(pageB, offenders)

    // A: 방 생성
    await pageA.goto('/room/new')
    await pageA.getByLabel('방 이름').fill('통합 테스트')
    await pageA.getByLabel('과목 또는 과제').fill('e2e')
    await pageA.getByRole('button', { name: '방 만들기' }).click()
    await expect(pageA.getByText(/[A-Z0-9]{6}/)).toBeVisible({ timeout: 20_000 })
    const code = (await pageA
      .locator('.tracking-\\[0\\.3em\\]')
      .textContent())!.trim()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)

    // B: 코드로 입장
    await pageB.goto('/room/new')
    await pageB.getByLabel('방 코드').fill(code)
    await pageB.getByRole('button', { name: '입장' }).click()
    await expect(pageB.getByText('참가자')).toBeVisible({ timeout: 20_000 })

    // 양쪽에 2명 표시
    await expect(pageA.getByText('2 / 2')).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText('2 / 2')).toBeVisible({ timeout: 20_000 })

    // 준비 완료 (양쪽)
    await pageA.getByRole('button', { name: '준비 완료' }).click()
    await pageB.getByRole('button', { name: '준비 완료' }).click()

    // 방장만 시작 버튼 활성화 → 시작
    await expect(pageB.getByRole('button', { name: '세션 시작' })).toHaveCount(0)
    const startButton = pageA.getByRole('button', { name: '세션 시작' })
    await expect(startButton).toBeEnabled({ timeout: 20_000 })
    await startButton.click()

    // 두 사람 모두 개인 세션 화면으로 이동 (각자 기기에서 독립 분석)
    await expect(pageA.getByText('남은 시간')).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText('남은 시간')).toBeVisible({ timeout: 20_000 })

    // 연결 끊김 → 개인 세션은 계속 (재연결은 이후 흐름이 증명)
    await contextB.setOffline(true)
    await pageB.waitForTimeout(1500)
    await expect(pageB.getByText('남은 시간')).toBeVisible()
    await contextB.setOffline(false)
    await pageB.waitForTimeout(2500)

    // 공동 보스 초기 HP 2000 동기화
    const bossA = pageA.getByRole('progressbar', { name: /마감괴수/ })
    await expect(bossA).toHaveAttribute('value', '100')

    // A 회복 성공 → 공동 보스 -40 (2000→1960 = 98%)
    await pageA.evaluate(() => {
      ;(window as unknown as { __upright?: { startRecovery(): void; recoverySuccess(): void } })
        .__upright?.startRecovery()
      ;(window as unknown as { __upright?: { recoverySuccess(): void } })
        .__upright?.recoverySuccess()
    })

    // B 화면에도 친구 회복 알림 + HP 반영 (98%)
    await expect(pageB.getByText(/회복 에너지를 보냈어요/)).toBeVisible({
      timeout: 20_000,
    })
    const bossB = pageB.getByRole('progressbar', { name: /마감괴수/ })
    await expect(bossB).toHaveAttribute('value', '98', { timeout: 20_000 })

    // B 도 10초 안에 회복 → 기린 싱크 (-60 추가: 1900 = 95%)
    await pageB.evaluate(() => {
      ;(window as unknown as { __upright?: { startRecovery(): void; recoverySuccess(): void } })
        .__upright?.startRecovery()
      ;(window as unknown as { __upright?: { recoverySuccess(): void } })
        .__upright?.recoverySuccess()
    })

    await expect(pageA.getByText(/기린 싱크/)).toBeVisible({ timeout: 20_000 })
    await expect(pageB.getByText(/기린 싱크/)).toBeVisible({ timeout: 20_000 })
    // 두 회복(-80) + 싱크(-60) = 1860 → 93%
    await expect(bossA).toHaveAttribute('value', '93', { timeout: 20_000 })
    await expect(bossB).toHaveAttribute('value', '93', { timeout: 20_000 })

    // A 스트레칭 완료 → 공동 방어막 +15 (B 화면에서 확인)
    await pageA.getByRole('button', { name: '스트레칭 예약' }).click()
    await pageA.getByRole('button', { name: '완료' }).click()
    await expect(pageB.getByText(/방어막 15/)).toBeVisible({ timeout: 20_000 })

    // 카메라 영상·프레임·랜드마크·bad 상태 전송 0건
    expect(offenders).toEqual([])

    await contextA.close()
    await contextB.close()
  })
})
