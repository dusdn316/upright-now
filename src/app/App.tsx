import { useEffect } from 'react'
import { AppRoutes } from './router/AppRoutes'
import { ToastProvider } from './providers/ToastProvider'
import { PostureGameBridge } from './providers/PostureGameBridge'
import { useDemoBootstrap } from '@/features/demo/useDemoBootstrap'
import { installDevApi } from '@/features/qa-lab/devApi'
import { installPersistence } from '@/features/persistence/persist'
import { unlockAudio } from '@/features/sound/soundEngine'
import { installSoundTriggers } from '@/features/sound/soundTriggers'
import { CampusThemeRoot } from '@/components/campus/CampusThemeRoot'
import { CampusContributionBridge } from '@/features/campus/CampusContributionBridge'
import { installCampusDevApi } from '@/features/campus/campusDevApi'
import { repairProgressionFromHistory } from '@/features/progression/repairProgression'

export function App() {
  // ?demo=1 또는 /lab 에서만 데모 값을 채웁니다.
  useDemoBootstrap()

  // 실제 사용자 데이터를 localStorage 에 저장합니다. (데모 값은 제외)
  useEffect(() => {
    const uninstall = installPersistence()
    installDevApi()
    installCampusDevApi()
    // 완료 기록 대비 상점 잠금·완료 수가 뒤처졌으면 자동 복구합니다.
    repairProgressionFromHistory()
    // 효과음: 사용자 제스처 후에만 AudioContext 시작 (자동 재생 금지)
    window.addEventListener('pointerdown', unlockAudio)
    const uninstallSound = installSoundTriggers()
    return () => {
      uninstall()
      window.removeEventListener('pointerdown', unlockAudio)
      uninstallSound()
    }
  }, [])

  return (
    <ToastProvider>
      {/* 자세 이벤트 → 게임 반응. UI 없음 */}
      <PostureGameBridge />
      {/* 캠퍼스 테마 색 주입 · 기여 이벤트 관찰. 플래그가 꺼져 있으면 아무 일도 하지 않습니다. */}
      <CampusThemeRoot />
      <CampusContributionBridge />
      <AppRoutes />
    </ToastProvider>
  )
}
