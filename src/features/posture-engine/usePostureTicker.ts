import { useEffect, useRef } from 'react'
import { usePostureStore } from './postureStore'
import { useSessionStore } from '@/features/sessions/sessionStore'

/**
 * 자세 상태 머신을 실제 시간으로 굴리는 유일한 드라이버.
 *
 * 순간 분류값(setInstant)이 언제 바뀌든, 회복 기회·성공·실패는 시간이 지나야
 * 판정되므로 별도의 티커가 필요합니다. 세션의 timeScale(QA 가속)을 반영해
 * 가상 시계를 진행시킵니다. 실제 시각이 아니라 누적 가상 시각을 넘깁니다.
 */
export function usePostureTicker(active: boolean, intervalMs = 250): void {
  const virtualNow = useRef(0)
  const lastReal = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      lastReal.current = null
      return
    }

    // 티커가 켜지는 순간 머신 시계를 현재 가상 시각에 맞춥니다.
    usePostureStore.setState((s) => ({
      machine: { ...s.machine, lastTickAt: virtualNow.current },
    }))

    const step = () => {
      const realNow =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      const scale = useSessionStore.getState().timeScale
      const realDelta =
        lastReal.current === null ? 0 : realNow - lastReal.current
      lastReal.current = realNow
      virtualNow.current += realDelta * scale
      usePostureStore.getState().tick(virtualNow.current)
    }

    const timer = window.setInterval(step, intervalMs)
    return () => window.clearInterval(timer)
  }, [active, intervalMs])
}
