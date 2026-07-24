import { create } from 'zustand'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useUserStore } from '@/features/onboarding/userStore'

/**
 * 데모 초기값과 실제 사용자 초기값을 분리합니다.
 *
 * 실제 사용자: XP 0 · 잎사귀 0 · Lv.1 뽀각 거북 (progressionStore 의 기본값)
 * 데모: 아래 값을 "명시적으로 진입할 때만" 덮어씁니다.
 *   - 랜딩의 `3분 데모 보기`
 *   - QA Lab(`/lab`)
 *   - 주소에 `?demo=1`
 *
 * 어떤 경로로도 데모 값이 일반 사용자 기본값으로 저장되지 않습니다.
 * (Phase 1은 영속화 자체가 없고, Phase 2에서 저장을 붙일 때도
 *  isDemo 가 true 인 동안에는 기록하지 않습니다.)
 */
export const DEMO_PROGRESSION = {
  xp: 700,
  points: 240,
} as const

export const DEMO_NICKNAME = '데모 기린'

export const DEMO_QUERY_KEY = 'demo'

interface DemoStoreState {
  isDemo: boolean
  enableDemo: () => void
  disableDemo: () => void
}

export const useDemoStore = create<DemoStoreState>((set) => ({
  isDemo: false,

  enableDemo: () => {
    // isDemo 를 먼저 켜서, 이어지는 스토어 변경이 영속화되지 않게 합니다.
    set({ isDemo: true })
    useProgressionStore.setState({
      xp: DEMO_PROGRESSION.xp,
      points: DEMO_PROGRESSION.points,
    })
    useUserStore.setState({
      nickname: DEMO_NICKNAME,
      hasOnboarded: true,
      hasCalibration: true,
    })
  },

  disableDemo: () => {
    useProgressionStore.getState().reset()
    useUserStore.getState().reset()
    set({ isDemo: false })
  },
}))

/** 주소에 ?demo=1 이 있는지 확인합니다. */
export function hasDemoQuery(search: string): boolean {
  const value = new URLSearchParams(search).get(DEMO_QUERY_KEY)
  return value === '1' || value === 'true'
}
