import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 1.5 — 시각적 QA와 전체 흐름 검증.
 * `npm run test:e2e` 가 Vite 개발 서버를 자동으로 띄우고 종료 시 정리합니다.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:5273',
    viewport: { width: 1440, height: 1000 },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5273 --strictPort',
    url: 'http://localhost:5273',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
