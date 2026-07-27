import { beforeEach, describe, expect, it } from 'vitest'
import {
  MONSTER_PHASE_HP,
  REWARD,
  sessionCompletionReward,
} from '@/constants/game'
import { applyReward, resetRewardsForTest } from './rewards'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useMonsterProgress } from './monsterProgress'
import { SHOP_ITEMS } from '@/constants/storeItems'
import { isRoomSessionActive, useRoomStore } from '@/features/rooms/roomStore'
import { useSessionStore } from '@/features/sessions/sessionStore'

describe('경제 v2 — 길이별 완주 보상', () => {
  it('구간별 지급표', () => {
    expect(sessionCompletionReward(5)).toEqual({ xp: 20, points: 10 })
    expect(sessionCompletionReward(25)).toEqual({ xp: 60, points: 30 })
    expect(sessionCompletionReward(45)).toEqual({ xp: 80, points: 40 })
    expect(sessionCompletionReward(120)).toEqual({ xp: 120, points: 60 })
    // 1분 점검은 보상 없음
    expect(sessionCompletionReward(1)).toEqual({ xp: 0, points: 0 })
  })

  it('행동 보상 표 — 회복 25/5, 스트레칭 10/10, 목표 15/10, 친구 20/10', () => {
    expect(REWARD.recovery).toEqual({ xp: 25, points: 5 })
    expect(REWARD.stretch).toEqual({ xp: 10, points: 10 })
    expect(REWARD.goalCompleted).toEqual({ xp: 15, points: 10 })
    expect(REWARD.roomCompleted).toEqual({ xp: 20, points: 10 })
  })
})

describe('applyReward override — 길이별 세션 완주', () => {
  beforeEach(() => {
    resetRewardsForTest()
    useProgressionStore.getState().reset()
  })

  it('override 지급량이 표 대신 적용된다', () => {
    const out = applyReward({
      id: 'sc-1',
      sessionId: 's1',
      type: 'session_completed',
      override: sessionCompletionReward(50),
    })
    expect(out.applied).toBe(true)
    expect(out.xp).toBe(120)
    expect(useProgressionStore.getState().points).toBe(60)
  })

  it('친구 공동 완주 보너스는 같은 id 로 1회만', () => {
    const a = applyReward({ id: 'fb-1', sessionId: 's1', type: 'friend_session_bonus' })
    const b = applyReward({ id: 'fb-1', sessionId: 's1', type: 'friend_session_bonus' })
    expect(a.applied).toBe(true)
    expect(a.xp).toBe(20)
    expect(b.applied).toBe(false)
  })
})

describe('상점 가격 v2 — 기존 아이템 id 유지', () => {
  it('기본 과잠 240P·백팩 180P, 특별 350~400P', () => {
    const jackets = SHOP_ITEMS.filter((i) => i.type === 'jacket' && i.id !== 'jacket-gold')
    const backpacks = SHOP_ITEMS.filter(
      (i) => i.type === 'backpack' && i.id !== 'backpack-galaxy',
    )
    for (const j of jackets) expect(j.price).toBe(240)
    for (const b of backpacks) expect(b.price).toBe(180)
    expect(SHOP_ITEMS.find((i) => i.id === 'jacket-gold')?.price).toBe(400)
    expect(SHOP_ITEMS.find((i) => i.id === 'backpack-galaxy')?.price).toBe(350)
  })
})

describe('개인 괴물 장기 진행도', () => {
  beforeEach(() => {
    useMonsterProgress.getState().reset()
  })

  it('세션이 끝나도 HP 가 유지되고 모드별로 분리된다', () => {
    const m = useMonsterProgress.getState()
    m.applyProgressDamage('bookmong', 100)
    expect(useMonsterProgress.getState().getBoss('bookmong').hp).toBe(
      MONSTER_PHASE_HP[0] - 100,
    )
    // 다른 괴물 진행도는 그대로
    expect(useMonsterProgress.getState().getBoss('neulmong').hp).toBe(
      MONSTER_PHASE_HP[0],
    )
  })

  it('처치하면 다음 phase 로, 4단계 이후엔 1단계 순환 + defeated 증가', () => {
    const m = useMonsterProgress.getState()
    expect(m.applyProgressDamage('komong', MONSTER_PHASE_HP[0]).evolved).toBe(true)
    expect(useMonsterProgress.getState().getBoss('komong')).toMatchObject({
      phase: 2,
      maxHp: MONSTER_PHASE_HP[1],
    })
    useMonsterProgress.getState().applyProgressDamage('komong', MONSTER_PHASE_HP[1])
    useMonsterProgress.getState().applyProgressDamage('komong', MONSTER_PHASE_HP[2])
    const last = useMonsterProgress
      .getState()
      .applyProgressDamage('komong', MONSTER_PHASE_HP[3])
    expect(last.evolved).toBe(true)
    const s = useMonsterProgress.getState()
    expect(s.getBoss('komong').phase).toBe(1)
    expect(s.monsters.komong?.defeated).toBe(1)
  })
})

describe('isRoomSessionActive — 4중 검사', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
    useSessionStore.getState().reset()
  })

  it('mode 만 room 으로 남은 sticky 상태는 개인 세션으로 본다', () => {
    useSessionStore.getState().configure({ mode: 'room' })
    expect(isRoomSessionActive()).toBe(false)
  })

  it('네 조건이 모두 맞을 때만 참', () => {
    useRoomStore.getState().patch({
      phase: 'running',
      roomId: 'r-1',
      code: 'ABC123',
    })
    useSessionStore.getState().configure({ mode: 'room' })
    useSessionStore.getState().start('room-ABC123')
    expect(isRoomSessionActive()).toBe(true)

    // 방이 끝나면 즉시 거짓
    useRoomStore.getState().patch({ phase: 'completed' })
    expect(isRoomSessionActive()).toBe(false)
  })
})
