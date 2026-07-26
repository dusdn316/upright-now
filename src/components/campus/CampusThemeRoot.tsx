import { useEffect } from 'react'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCampusTheme } from '@/features/campus/campusThemeStore'

/**
 * 선택한 학교의 색을 `--campus-*` CSS 변수로 주입합니다.
 *
 * 캠퍼스 테마 플래그가 꺼져 있거나 학교를 고르지 않으면 변수를 지우므로,
 * 기존 앱 색(핑크·파랑·초록)이 그대로 유지됩니다.
 * 자세 상태 색(good/warning/bad)은 절대 덮어쓰지 않습니다.
 */
const VARS = [
  '--campus-primary',
  '--campus-soft',
  '--campus-soft-strong',
  '--campus-on-primary',
  '--campus-deep',
] as const

export function CampusThemeRoot() {
  const theme = useCampusTheme()
  const enabled = featureFlags.campusTheme && theme !== null

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    if (!enabled || !theme) {
      for (const name of VARS) root.style.removeProperty(name)
      root.removeAttribute('data-campus-school')
      return
    }

    root.style.setProperty('--campus-primary', theme.primary)
    root.style.setProperty('--campus-soft', theme.soft)
    root.style.setProperty('--campus-soft-strong', theme.softStrong)
    root.style.setProperty('--campus-on-primary', theme.onPrimary)
    root.style.setProperty('--campus-deep', theme.deep)
    root.setAttribute('data-campus-school', theme.schoolId)

    return () => {
      for (const name of VARS) root.style.removeProperty(name)
      root.removeAttribute('data-campus-school')
    }
  }, [enabled, theme])

  return null
}
