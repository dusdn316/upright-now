import { useEffect } from 'react'
import { AppRoutes } from './router/AppRoutes'
import { ToastProvider } from './providers/ToastProvider'
import { PostureGameBridge } from './providers/PostureGameBridge'
import { useDemoBootstrap } from '@/features/demo/useDemoBootstrap'
import { installDevApi } from '@/features/qa-lab/devApi'
import { installPersistence } from '@/features/persistence/persist'

export function App() {
  // ?demo=1 또는 /lab 에서만 데모 값을 채웁니다.
  useDemoBootstrap()

  // 실제 사용자 데이터를 localStorage 에 저장합니다. (데모 값은 제외)
  useEffect(() => {
    const uninstall = installPersistence()
    installDevApi()
    return uninstall
  }, [])

  return (
    <ToastProvider>
      {/* 자세 이벤트 → 게임 반응. UI 없음 */}
      <PostureGameBridge />
      <AppRoutes />
    </ToastProvider>
  )
}
