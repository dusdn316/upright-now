import { beforeEach, describe, expect, it } from 'vitest'
import { useProgressionStore } from './progressionStore'
import { SHOP_ITEMS, getShopItem } from '@/constants/storeItems'

const navy = getShopItem('jacket-navy')!
const freshman = getShopItem('backpack-freshman')!

describe('상점 — 구매·장착 (Gate 1)', () => {
  beforeEach(() => {
    useProgressionStore.getState().reset()
  })

  it('아이템 구성: 과잠 4개 100P · 백팩 3개 80P', () => {
    const jackets = SHOP_ITEMS.filter((i) => i.type === 'jacket')
    const backpacks = SHOP_ITEMS.filter((i) => i.type === 'backpack')
    expect(jackets).toHaveLength(4)
    expect(backpacks).toHaveLength(3)
    expect(jackets.every((i) => i.price === 100)).toBe(true)
    expect(backpacks.every((i) => i.price === 80)).toBe(true)
  })

  it('포인트가 부족하면 구매되지 않는다', () => {
    useProgressionStore.setState({ points: 50 })
    expect(useProgressionStore.getState().purchaseItem(navy.id, navy.price)).toBe(false)
    expect(useProgressionStore.getState().points).toBe(50)
    expect(useProgressionStore.getState().inventory).toHaveLength(0)
  })

  it('구매하면 포인트가 차감되고 인벤토리에 들어간다', () => {
    useProgressionStore.setState({ points: 150 })
    expect(useProgressionStore.getState().purchaseItem(navy.id, navy.price)).toBe(true)
    expect(useProgressionStore.getState().points).toBe(50)
    expect(useProgressionStore.getState().inventory).toContain(navy.id)
  })

  it('같은 아이템 중복 구매를 막는다', () => {
    useProgressionStore.setState({ points: 300 })
    useProgressionStore.getState().purchaseItem(navy.id, navy.price)
    expect(useProgressionStore.getState().purchaseItem(navy.id, navy.price)).toBe(false)
    expect(useProgressionStore.getState().points).toBe(200)
    expect(
      useProgressionStore.getState().inventory.filter((id) => id === navy.id),
    ).toHaveLength(1)
  })

  it('과잠·백팩을 각각 하나씩 장착하고 해제할 수 있다', () => {
    useProgressionStore.setState({ points: 500 })
    useProgressionStore.getState().purchaseItem(navy.id, navy.price)
    useProgressionStore.getState().purchaseItem('jacket-coral', 100)
    useProgressionStore.getState().purchaseItem(freshman.id, freshman.price)

    useProgressionStore.getState().equipItem('jacket', navy.id)
    useProgressionStore.getState().equipItem('backpack', freshman.id)
    expect(useProgressionStore.getState().equipped).toEqual({
      jacketId: navy.id,
      backpackId: freshman.id,
    })

    // 다른 과잠으로 교체 — 한 번에 하나만
    useProgressionStore.getState().equipItem('jacket', 'jacket-coral')
    expect(useProgressionStore.getState().equipped.jacketId).toBe('jacket-coral')
    expect(useProgressionStore.getState().equipped.backpackId).toBe(freshman.id)

    // 해제
    useProgressionStore.getState().equipItem('jacket', undefined)
    expect(useProgressionStore.getState().equipped.jacketId).toBeUndefined()
  })

  it('보유하지 않은 아이템은 장착할 수 없다', () => {
    useProgressionStore.getState().equipItem('jacket', navy.id)
    expect(useProgressionStore.getState().equipped.jacketId).toBeUndefined()
  })

  it('첫 세션 완료 전에는 상점이 잠겨 있고, 완료 후 해제된다', () => {
    expect(useProgressionStore.getState().shopUnlocked).toBe(false)
    useProgressionStore.getState().completeSessionMark('2026-07-25')
    expect(useProgressionStore.getState().shopUnlocked).toBe(true)
  })
})
