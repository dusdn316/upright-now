import type { Page } from '@playwright/test'

/**
 * 사용자 화면에는 개발용 위젯을 두지 않으므로,
 * E2E 는 QA Lab 플래그가 켜졌을 때만 설치되는 window.__upright 로 상태를 주입합니다.
 */
export async function dev(
  page: Page,
  method: string,
  ...args: unknown[]
): Promise<void> {
  await page.evaluate(
    ({ method: m, args: a }) => {
      const api = (
        window as unknown as {
          __upright?: Record<string, (...rest: unknown[]) => void>
        }
      ).__upright
      if (!api) {
        throw new Error('window.__upright 가 없습니다. QA Lab 플래그를 확인하세요.')
      }
      api[m](...a)
    },
    { method, args },
  )
}
