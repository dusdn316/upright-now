import { useState } from 'react'
import {
  CharacterViewport,
  type CharacterViewportProps,
} from './CharacterViewport'
import { getShopItem } from '@/constants/storeItems'
import { Icon } from '@/components/ui/Icon'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCampusTheme } from '@/features/campus/campusThemeStore'
import type { CharacterStage } from '@/types'

/**
 * 캐릭터 + 장착 아이템 — 승인된 stage 전용 레이어 이미지를 실제로 겹칩니다.
 *
 * 레이어 순서 (아래→위):
 *   1. 백팩 back → 2. 기본 캐릭터 → 3. 과잠 → 4. 백팩 front
 *   (자세/회복/공격 연출은 CharacterViewport 의 CSS 가 전체에 적용)
 *
 * 각 stage 는 그 stage 전용 레이어만 사용합니다 — 다른 stage 레이어를
 * CSS 위치 보정으로 재사용하지 않습니다. 특별 아이템(황금 과잠·은하 백팩)은
 * 새 그림 없이 기본 레이어를 CSS mask + gradient 로 표현합니다.
 * 이미지 로드 실패 시 기존 색 리본·아이콘 배지 폴백을 유지합니다.
 */
const LAYER_BASE = '/assets/store/layers'

/** 승인 레이어가 있는 아이템 — 특별 아이템은 기본 레이어를 마스크로 씁니다. */
const JACKET_LAYER: Record<string, { file: string; gradient?: string }> = {
  'jacket-navy': { file: 'jacket-navy' },
  'jacket-burgundy': { file: 'jacket-burgundy' },
  'jacket-forest': { file: 'jacket-forest' },
  'jacket-coral': { file: 'jacket-coral' },
  'jacket-gold': {
    file: 'jacket-navy',
    gradient: 'linear-gradient(135deg, #f9e27d 0%, #f2c94c 45%, #c9962b 100%)',
  },
}

const BACKPACK_LAYER: Record<string, { file: string; gradient?: string }> = {
  'backpack-freshman': { file: 'backpack-freshman' },
  'backpack-library': { file: 'backpack-library' },
  'backpack-team': { file: 'backpack-team' },
  'backpack-galaxy': {
    file: 'backpack-freshman',
    gradient: 'linear-gradient(150deg, #2c2a5e 0%, #5f8ff7 55%, #b28ce8 100%)',
  },
}

function jacketSrc(file: string, stage: CharacterStage): string {
  return `${LAYER_BASE}/jackets/${file}/stage-${String(stage).padStart(2, '0')}.webp`
}

function backpackSrc(
  file: string,
  stage: CharacterStage,
  side: 'back' | 'front',
): string {
  return `${LAYER_BASE}/backpacks/${file}/stage-${String(stage).padStart(2, '0')}-${side}.webp`
}

/** 특별 아이템 — 기본 레이어의 alpha 를 mask 로 쓰고 gradient 로 채웁니다. */
function GearLayer({
  src,
  gradient,
  onError,
}: {
  src: string
  gradient?: string
  onError: () => void
}) {
  if (gradient) {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: gradient,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={onError}
      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
    />
  )
}

export function CharacterWithGear(props: CharacterViewportProps) {
  const equipped = useProgressionStore((s) => s.equipped)
  const jacket = getShopItem(equipped.jacketId)
  const backpack = getShopItem(equipped.backpackId)
  const campusTheme = useCampusTheme()
  const size = props.size ?? 200
  const badge = Math.max(24, Math.round(size * 0.14))
  const [layerBroken, setLayerBroken] = useState(false)

  const stage = props.stage
  const jacketLayer = jacket ? JACKET_LAYER[jacket.id] : undefined
  const backpackLayer = backpack ? BACKPACK_LAYER[backpack.id] : undefined
  const useLayers = !layerBroken && (jacketLayer || backpackLayer)

  const campusActive = featureFlags.campusTheme && campusTheme !== null
  const jacketColor =
    campusActive && campusTheme ? campusTheme.primary : jacket?.color
  const jacketTextColor =
    campusActive && campusTheme ? campusTheme.onPrimary : '#FFFFFF'
  const backpackAccent =
    campusActive && campusTheme ? campusTheme.primary : undefined

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* 1) 백팩 back — 캐릭터 뒤 */}
      {useLayers && backpackLayer && (
        <GearLayer
          src={backpackSrc(backpackLayer.file, stage, 'back')}
          gradient={backpackLayer.gradient}
          onError={() => setLayerBroken(true)}
        />
      )}

      {/* 2) 기본 캐릭터 (+ 상태·회복·공격 연출) */}
      <CharacterViewport {...props} />

      {/* 3) 과잠 */}
      {useLayers && jacketLayer && (
        <GearLayer
          src={jacketSrc(jacketLayer.file, stage)}
          gradient={jacketLayer.gradient}
          onError={() => setLayerBroken(true)}
        />
      )}

      {/* 4) 백팩 front — 어깨끈 */}
      {useLayers && backpackLayer && (
        <GearLayer
          src={backpackSrc(backpackLayer.file, stage, 'front')}
          gradient={
            backpackLayer.gradient
              ? `${backpackLayer.gradient.slice(0, -1)}, rgba(0,0,0,0.12))`
              : undefined
          }
          onError={() => setLayerBroken(true)}
        />
      )}

      {/* 스크린리더용 장착 설명 */}
      {(jacket || backpack) && (
        <span className="sr-only">
          {[jacket && `${jacket.name} 장착 중`, backpack && `${backpack.name} 장착 중`]
            .filter(Boolean)
            .join(', ')}
        </span>
      )}

      {/* 이미지 레이어 실패 시 — 기존 배지 폴백 */}
      {layerBroken && jacket && (
        <span
          data-testid="gear-jacket"
          title={jacket.name}
          className="absolute bottom-[8%] left-[6%] flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-card"
          style={{
            backgroundColor: jacketColor,
            color: jacketTextColor,
            minHeight: badge * 0.7,
          }}
        >
          과잠
        </span>
      )}
      {layerBroken && backpack && (
        <span
          data-testid="gear-backpack"
          title={backpack.name}
          className="absolute right-[6%] bottom-[8%] flex items-center justify-center rounded-full border bg-surface shadow-card"
          style={{
            width: badge,
            height: badge,
            borderColor: backpackAccent ?? 'var(--color-line)',
            color: backpackAccent ?? 'var(--color-ink)',
          }}
        >
          <Icon name={backpack.icon ?? 'bag'} size={Math.round(badge * 0.6)} />
        </span>
      )}
    </div>
  )
}
