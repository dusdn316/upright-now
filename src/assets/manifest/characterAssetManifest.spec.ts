import { describe, expect, it } from 'vitest'
import {
  describeCharacter,
  resolveAssetState,
  resolveCharacterAsset,
} from './characterAssetManifest'

describe('resolveAssetState — 자세 상태·게임 표현 → 에셋 상태', () => {
  it('자세 상태를 에셋 상태로 옮긴다', () => {
    expect(resolveAssetState('good')).toBe('idle')
    expect(resolveAssetState('warning')).toBe('warning')
    expect(resolveAssetState('bad')).toBe('slouch')
  })

  it('게임 표현이 자세보다 우선한다', () => {
    expect(resolveAssetState('bad', 'recover')).toBe('recover')
    expect(resolveAssetState('good', 'attack')).toBe('attack')
  })

  it('away·unstable 는 이미지가 없으므로 각각 away·idle 로 매핑된다', () => {
    expect(resolveAssetState('away')).toBe('away')
    expect(resolveAssetState('unstable')).toBe('idle')
  })
})

describe('resolveCharacterAsset — 폴백 순서', () => {
  it.each([1, 3] as const)('Lv.%i 는 5가지 상태 이미지를 정확히 가진다', (stage) => {
    for (const state of ['idle', 'warning', 'slouch', 'recover', 'attack'] as const) {
      const result = resolveCharacterAsset(stage, state)
      expect(result?.state).toBe(state)
      expect(result?.exact).toBe(true)
      expect(result?.src).toContain(`stage-0${stage}/${state}.webp`)
    }
  })

  it('상태 이미지가 없으면 해당 단계 idle 로 내려온다', () => {
    // Lv.5 는 idle 만 있음 → slouch 요청 시 idle
    const result = resolveCharacterAsset(5, 'slouch')
    expect(result?.state).toBe('idle')
    expect(result?.exact).toBe(false)
    expect(result?.src).toContain('stage-05/idle.webp')
  })

  it('사용 불가로 표시된 경로는 건너뛴다', () => {
    const broken = new Set(['/assets/characters/stage-03/slouch.webp'])
    const result = resolveCharacterAsset(3, 'slouch', broken)
    expect(result?.state).toBe('idle')
  })

  it('idle 까지 사용 불가면 null → SVG 폴백', () => {
    const broken = new Set(['/assets/characters/stage-05/idle.webp'])
    expect(resolveCharacterAsset(5, 'slouch', broken)).toBeNull()
  })
})

describe('describeCharacter — 대체 텍스트', () => {
  it('단계 이름과 상태를 담는다', () => {
    expect(describeCharacter(3, 'idle')).toBe(
      'Lv.3 빼꼼 거부기린이 편안하게 공부하는 모습',
    )
    expect(describeCharacter(3, 'slouch')).toBe(
      'Lv.3 빼꼼 거부기린이 몸을 움츠린 모습',
    )
    expect(describeCharacter(3, 'recover')).toBe(
      'Lv.3 빼꼼 거부기린이 자세를 회복하는 모습',
    )
  })
})
