import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { CharacterWithGear } from './CharacterWithGear'
import { useProgressionStore } from '@/features/progression/progressionStore'

/**
 * 상점 미리보기(§8) — preview 렌더가 progression store 의
 * inventory/equipped 를 절대 바꾸지 않는지 검증합니다.
 */
describe('CharacterWithGear preview override', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('preview 렌더는 store 상태를 변경하지 않는다', () => {
    const before = JSON.stringify({
      inventory: useProgressionStore.getState().inventory,
      equipped: useProgressionStore.getState().equipped,
      points: useProgressionStore.getState().points,
    })

    render(
      <CharacterWithGear
        stage={3}
        size={112}
        ignoreCurrentlyEquipped
        previewJacketId="jacket-navy"
        previewBackpackId={null}
      />,
    )
    render(
      <CharacterWithGear
        stage={1}
        size={112}
        ignoreCurrentlyEquipped
        previewJacketId={null}
        previewBackpackId="backpack-galaxy"
      />,
    )

    const after = JSON.stringify({
      inventory: useProgressionStore.getState().inventory,
      equipped: useProgressionStore.getState().equipped,
      points: useProgressionStore.getState().points,
    })
    expect(after).toBe(before)
  })

  it('ignoreCurrentlyEquipped 는 장착 아이템 대신 preview 만 그린다', () => {
    useProgressionStore.setState({
      equipped: { jacketId: 'jacket-coral', backpackId: 'backpack-team' },
    })

    const { container } = render(
      <CharacterWithGear
        stage={2}
        size={112}
        ignoreCurrentlyEquipped
        previewJacketId="jacket-navy"
        previewBackpackId={null}
      />,
    )

    const sources = [...container.querySelectorAll('img')].map((img) => img.src)
    expect(sources.some((s) => s.includes('jacket-navy'))).toBe(true)
    expect(sources.some((s) => s.includes('jacket-coral'))).toBe(false)
    expect(sources.some((s) => s.includes('backpack-team'))).toBe(false)
  })

  it('preview 없이 렌더하면 기존 장착 아이템을 그대로 그린다 (회귀 없음)', () => {
    useProgressionStore.setState({
      equipped: { jacketId: 'jacket-coral', backpackId: undefined },
    })

    const { container } = render(<CharacterWithGear stage={2} size={112} />)
    const sources = [...container.querySelectorAll('img')].map((img) => img.src)
    expect(sources.some((s) => s.includes('jacket-coral'))).toBe(true)
  })
})
