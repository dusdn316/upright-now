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
      기본 5초는 파일 수가 늘어난 뒤 부하가 걸린 머신에서 userEvent 기반
      테스트(QA Lab)가 간헐적으로 시간을 넘겼습니다. 판정 자체는 그대로 두고
      여유만 줍니다.
    */
    testTimeout: 15_000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
