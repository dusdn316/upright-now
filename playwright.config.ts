import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// .env.local 을 읽어 라이브 친구 방 테스트(room-live)가 env 를 인식하게 합니다.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

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
