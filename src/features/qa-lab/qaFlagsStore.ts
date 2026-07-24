import { create } from 'zustand'

/**
 * QA Lab 에서 켜는 실패 상황 스위치.
 * 운영 화면에는 노출되지 않고, 폴백 경로를 눈으로 확인할 때만 씁니다.
 */
interface QaFlagsState {
  /** 캐릭터 이미지 로딩이 실패한 상황을 흉내 냅니다. */
  characterImagesBroken: boolean
  setCharacterImagesBroken: (value: boolean) => void
}

export const useQaFlagsStore = create<QaFlagsState>((set) => ({
  characterImagesBroken: false,
  setCharacterImagesBroken: (value) => set({ characterImagesBroken: value }),
}))
