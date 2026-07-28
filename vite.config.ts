/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    /*
      테스트 파일 수집 안정화.

      vitest 는 기본적으로 CPU 코어 수만큼 forks 워커를 동시에 띄웁니다.
      이 프로젝트 규모(spec 50개 · jsdom 환경)에서는 워커가 한꺼번에 뜨면
      기동이 밀려 `[vitest-pool]: Failed to start forks worker ...
      Timeout waiting for worker to respond` 가 나고, 그 파일들이 결과에서
      조용히 빠집니다. (실행마다 28/37/47/50 파일로 달라졌고 exit 0 이라
      "통과"로 보였습니다.)

      동시 워커를 3개로 제한하면 기동 경합이 사라져 50개가 매번 수집됩니다.
      완전 순차(fileParallelism: false)보다 2배 이상 빠릅니다.
      그래도 재발한다면 maxForks 를 2 로 낮추거나
      fileParallelism: false 로 바꾸세요.
    */
    poolOptions: {
      forks: { maxForks: 3, minForks: 1 },
    },
    // 느린 머신·병렬 실행에서 App 전체 렌더 셋업이 5초를 넘길 수 있어
    // 기본 npm run test 에서도 안정적으로 통과하도록 여유를 둡니다.
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
