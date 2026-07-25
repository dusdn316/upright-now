import { create } from 'zustand'

/**
 * PIP 미니 위젯 상태.
 * 새로고침 시 자동 복원하지 않습니다 — 다음 세션 시작 시 다시 생성합니다.
 */
interface PipStoreState {
  /** Document PiP 창이 열려 있는지 */
  pipOpen: boolean
  /** PiP 를 열 수 없어 화면 안 미니 위젯으로 대체 중인지 */
  fallbackActive: boolean
  patch: (partial: Partial<Pick<PipStoreState, 'pipOpen' | 'fallbackActive'>>) => void
  reset: () => void
}

export const usePipStore = create<PipStoreState>((set) => ({
  pipOpen: false,
  fallbackActive: false,
  patch: (partial) => set(partial),
  reset: () => set({ pipOpen: false, fallbackActive: false }),
}))
