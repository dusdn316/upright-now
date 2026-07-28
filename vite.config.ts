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
      테스트 파일 수집 안정화 (2026-07-29).

      증상: `npm run test` 를 돌릴 때마다 수집되는 spec 파일 수가
      28 / 37 / 42 / 47 / 50 으로 달라졌고, 그런데도 종료 코드가 0 이라
      "전부 통과"로 보였습니다.

      원인: vitest 는 기본적으로 CPU 코어 수만큼 forks(자식 프로세스) 워커를
      동시에 띄웁니다. 이 프로젝트는 spec 50개가 모두 jsdom 환경이라 워커
      하나하나가 무겁고, 동시에 뜨면 이 개발 머신에서 프로세스가 기동에
      실패하거나(`Timeout waiting for worker to respond`) 도중에 죽습니다
      (`Worker forks emitted error` / `emitUnexpectedExit`).
      실패한 워커가 맡은 파일은 결과 집계에서 조용히 빠집니다.
      워커를 3개로 줄여도 재현됐습니다(42/50).

      해결: 파일 병렬 실행을 끄고 워커 하나로 순차 실행합니다.
      느리지만(약 6분) 매번 50개 전부를 수집합니다.
      추가 안전장치로 `npm run test` 는 scripts/run-tests.mjs 를 거쳐
      수집된 파일 수가 디스크의 spec 파일 수와 다르면 실패합니다.

      더 빠른 머신으로 옮겨 이 문제가 사라지면 이 줄을 지우면 됩니다.
      (그때도 run-tests.mjs 가드는 남겨 두세요.)
    */
    fileParallelism: false,
    // 느린 머신·병렬 실행에서 App 전체 렌더 셋업이 5초를 넘길 수 있어
    // 기본 npm run test 에서도 안정적으로 통과하도록 여유를 둡니다.
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
