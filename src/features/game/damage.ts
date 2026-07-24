/**
 * 보스 피해 계산 — 순수 함수.
 * 같은 eventId는 두 번 적용되지 않습니다. (docs/07 §12, docs/08 §10)
 * Phase 5의 Supabase apply_room_damage RPC와 동일한 멱등 규칙입니다.
 */
export interface BossState {
  hp: number
  maxHp: number
  processedEventIds: string[]
}

export interface DamageInput {
  eventId: string
  amount: number
}

export interface DamageResult {
  state: BossState
  /** 실제로 적용된 피해량. 중복 이벤트면 0입니다. */
  applied: number
}

export function applyDamage(state: BossState, input: DamageInput): DamageResult {
  if (state.processedEventIds.includes(input.eventId)) {
    return { state, applied: 0 }
  }

  const amount = Math.max(0, Math.round(input.amount))
  const nextHp = Math.max(0, state.hp - amount)

  return {
    state: {
      ...state,
      hp: nextHp,
      processedEventIds: [...state.processedEventIds, input.eventId],
    },
    applied: state.hp - nextHp,
  }
}

export function createBossState(maxHp: number): BossState {
  return { hp: maxHp, maxHp, processedEventIds: [] }
}
