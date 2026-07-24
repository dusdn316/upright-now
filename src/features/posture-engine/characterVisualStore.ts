import { create } from 'zustand'
import type { CharacterVisualIntent } from '@/assets/manifest/characterAssetManifest'

/**
 * 게임이 지정하는 "표현" 상태.
 *
 * 자세 상태(good/warning/bad/…)와 별개로, 회복 중(recover)·공격(attack) 같은
 * 순간 연출을 캐릭터에 지정합니다. 자세 엔진이 아니라 게임/데모가 씁니다.
 * null 이면 자세 상태를 그대로 따릅니다.
 */
interface CharacterVisualState {
  intent: CharacterVisualIntent | null
  setIntent: (intent: CharacterVisualIntent | null) => void
}

export const useCharacterVisualStore = create<CharacterVisualState>((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
}))
