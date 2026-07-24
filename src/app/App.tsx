import { useEffect } from 'react'
import { AppRoutes } from './router/AppRoutes'
import { ToastProvider } from './providers/ToastProvider'
import { PostureGameBridge } from './providers/PostureGameBridge'
import { useDemoBootstrap } from '@/features/demo/useDemoBootstrap'
import { installDevApi } from '@/features/qa-lab/devApi'

export function App() {
  // ?demo=1 또는 /lab 에서만 데모 값을 채웁니다.
  useDemoBootstrap()

  // QA Lab 플래그가 켜진 빌드에서만 window.__upright 를 설치합니다.
  useEffect(() => {
    installDevApi()
  }, [])

  return (
    <ToastProvider>
      {/* 자세 이벤트 → 게임 반응. UI 없음 */}
      <PostureGameBridge />
      <AppRoutes />
    </ToastProvider>
  )
}
