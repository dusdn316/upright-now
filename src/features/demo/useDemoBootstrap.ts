import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { hasDemoQuery, useDemoStore } from './demoMode'
import { featureFlags } from '@/lib/feature-flags/flags'

/**
 * 주소에 ?demo=1 이 있거나 QA Lab(/lab)에 들어오면 데모 값을 채웁니다.
 * 그 외의 일반 진입에서는 실제 사용자 초기값(XP 0 · Lv.1)을 유지합니다.
 */
export function useDemoBootstrap(): void {
  const location = useLocation()
  const isDemo = useDemoStore((s) => s.isDemo)

  useEffect(() => {
    if (isDemo) return

    // QA Lab 이 꺼진 빌드에서는 /lab 진입만으로 데모 값을 채우지 않습니다.
    const isQaLabEntry = featureFlags.qaLab && location.pathname === '/lab'

    if (hasDemoQuery(location.search) || isQaLabEntry) {
      useDemoStore.getState().enableDemo()
    }
  }, [isDemo, location.pathname, location.search])
}
