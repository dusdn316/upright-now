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

/**
 * 데모 진입 직전의 실제 사용자 상태 스냅샷 (메모리 전용).
 * persist 가 데모 값을 저장하지 않으므로 localStorage 는 원래 그대로이고,
 * 이 스냅샷은 같은 탭에서 새로고침 없이 데모를 끝낼 때 복원에 씁니다.
 */
let beforeDemo: {
  progression: { xp: number; points: number }
  user: { nickname: string; hasOnboarded: boolean; hasCalibration: boolean }
} | null = null

export const useDemoStore = create<DemoStoreState>((set, get) => ({
  isDemo: false,

  enableDemo: () => {
    if (get().isDemo) return
    const prog = useProgressionStore.getState()
    const user = useUserStore.getState()
    beforeDemo = {
      progression: { xp: prog.xp, points: prog.points },
      user: {
        nickname: user.nickname,
        hasOnboarded: user.hasOnboarded,
        hasCalibration: user.hasCalibration,
      },
    }
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
    if (!get().isDemo) return
    // 데모 진입 전 상태를 그대로 복원합니다. (실제 데이터는 reset 하지 않음)
    if (beforeDemo) {
      useProgressionStore.setState({ ...beforeDemo.progression })
      useUserStore.setState({ ...beforeDemo.user })
      beforeDemo = null
    } else {
      useProgressionStore.getState().reset()
      useUserStore.getState().reset()
    }
    set({ isDemo: false })
  },
}))

/** 주소에 ?demo=1 이 있는지 확인합니다. */
export function hasDemoQuery(search: string): boolean {
  const value = new URLSearchParams(search).get(DEMO_QUERY_KEY)
  return value === '1' || value === 'true'
}
