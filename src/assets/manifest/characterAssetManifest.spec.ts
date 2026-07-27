import { describe, expect, it } from 'vitest'
import {
  CHARACTER_ASSETS,
  characterAssetLarge,
  describeCharacter,
  resolveAssetState,
  resolveCharacterAsset,
} from './characterAssetManifest'
import type { CharacterStage } from '@/types'

/**
 * 승인 디자인 v1 — 단계별 이미지는 idle 한 장이 단일 기준이고,
 * 상태(warning·slouch·recover·attack·away·unstable)는 CSS 연출로 표현합니다.
 */
describe('resolveAssetState — 자세 상태·게임 표현 → 에셋 상태', () => {
  it('자세 상태를 연출 상태로 옮긴다 (unstable 포함)', () => {
    expect(resolveAssetState('good')).toBe('idle')
    expect(resolveAssetState('warning')).toBe('warning')
    expect(resolveAssetState('bad')).toBe('slouch')
    expect(resolveAssetState('away')).toBe('away')
    expect(resolveAssetState('unstable')).toBe('unstable')
  })

  it('게임 표현(attack·recover)이 자세 상태보다 우선한다', () => {
    expect(resolveAssetState('bad', 'attack')).toBe('attack')
    expect(resolveAssetState('good', 'recover')).toBe('recover')
  })
})

describe('resolveCharacterAsset — 승인 6단계 단일 이미지 + 폴백', () => {
  it('6단계 모두 승인 idle 이미지 하나만 가진다', () => {
    for (let stage = 1; stage <= 6; stage += 1) {
      const assets = CHARACTER_ASSETS[stage as CharacterStage]
      expect(Object.keys(assets)).toEqual(['idle'])
      expect(assets.idle).toBe(
        `/assets/characters/stages/stage-0${stage}/idle-512.webp`,
      )
    }
  })

  it('모든 상태 요청은 해당 단계의 idle 이미지로 내려온다 (연출은 CSS)', () => {
    for (const state of ['warning', 'slouch', 'recover', 'attack', 'away'] as const) {
      const resolved = resolveCharacterAsset(3, state)
      expect(resolved?.src).toBe('/assets/characters/stages/stage-03/idle-512.webp')
      expect(resolved?.state).toBe('idle')
      expect(resolved?.exact).toBe(false)
    }
  })

  it('idle 까지 사용 불가면 null → SVG 폴백', () => {
    const unavailable = new Set([
      '/assets/characters/stages/stage-02/idle-512.webp',
    ])
    expect(resolveCharacterAsset(2, 'idle', unavailable)).toBeNull()
  })

  it('큰 화면용 1024 변형 경로를 제공한다', () => {
    expect(characterAssetLarge(6)).toBe(
      '/assets/characters/stages/stage-06/idle-1024.webp',
    )
  })
})

describe('describeCharacter — 대체 텍스트', () => {
  it('단계 이름과 상태 설명을 함께 담는다', () => {
    expect(describeCharacter(1, 'idle')).toContain('Lv.1')
    expect(describeCharacter(6, 'unstable')).toContain('측정이 잠시 흔들리는')
  })
})
