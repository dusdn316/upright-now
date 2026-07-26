import { create } from 'zustand'
import { loadLocal, saveLocal } from '@/lib/storage/local'
import { MONSTER_PHASE_HP } from '@/constants/game'
import type { MonsterThemeId } from '@/features/modes/modeStore'

/**
 * 개인 괴물 장기 진행도 — 세션이 끝나도 모드별 괴물 HP 가 유지됩니다.
 * phase 1~4 (600/900/1300/1800), 처치하면 다음 phase.
 * 4단계 처치 후에는 defeated 를 올리고 1단계부터 다시 순환합니다.
 * 데모·1분 점검·친구 방(공동 꼬몽이는 방 DB 소유)은 반영하지 않습니다.
 */
export interface MonsterState {
  phase: 1 | 2 | 3 | 4
  hp: number
  defeated: number
}

interface MonsterProgressState {
  monsters: Partial<Record<MonsterThemeId, MonsterState>>
  getBoss: (theme: MonsterThemeId) => { hp: number; maxHp: number; phase: number }
  applyProgressDamage: (
    theme: MonsterThemeId,
    amount: number,
  ) => { evolved: boolean; phase: number }
  reset: () => void
}

const KEY = 'monster'

function freshMonster(): MonsterState {
  return { phase: 1, hp: MONSTER_PHASE_HP[0], defeated: 0 }
}

const persisted = loadLocal<Partial<Record<MonsterThemeId, MonsterState>>>(KEY, {})

export const useMonsterProgress = create<MonsterProgressState>((set, get) => ({
  monsters: persisted,

  getBoss: (theme) => {
    const m = get().monsters[theme] ?? freshMonster()
    return { hp: m.hp, maxHp: MONSTER_PHASE_HP[m.phase - 1], phase: m.phase }
  },

  applyProgressDamage: (theme, amount) => {
    const current = get().monsters[theme] ?? freshMonster()
    let { phase, hp, defeated } = current
    hp -= amount
    let evolved = false
    if (hp <= 0) {
      evolved = true
      if (phase < 4) {
        phase = (phase + 1) as MonsterState['phase']
      } else {
        phase = 1
        defeated += 1
      }
      hp = MONSTER_PHASE_HP[phase - 1]
    }
    const monsters = { ...get().monsters, [theme]: { phase, hp, defeated } }
    saveLocal(KEY, monsters)
    set({ monsters })
    return { evolved, phase }
  },

  reset: () => {
    saveLocal(KEY, {})
    set({ monsters: {} })
  },
}))
