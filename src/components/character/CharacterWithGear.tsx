import {
  CharacterViewport,
  type CharacterViewportProps,
} from './CharacterViewport'
import { getShopItem } from '@/constants/storeItems'
import { Icon } from '@/components/ui/Icon'
import { useProgressionStore } from '@/features/progression/progressionStore'

/**
 * 캐릭터 + 장착 아이템 표시.
 *
 * 실제 의상 이미지 레이어가 준비되기 전까지, 장착 과잠은 색 리본 배지로,
 * 장착 백팩은 작은 아이콘 배지로 캐릭터 위에 표시합니다.
 * 상점·성장·대시보드에서 같은 컴포넌트를 사용합니다.
 * (equippedJacketId / equippedBackpackId 분리 → 나중에 이미지 레이어로 교체 용이)
 */
export function CharacterWithGear(props: CharacterViewportProps) {
  const equipped = useProgressionStore((s) => s.equipped)
  const jacket = getShopItem(equipped.jacketId)
  const backpack = getShopItem(equipped.backpackId)
  const size = props.size ?? 200
  const badge = Math.max(24, Math.round(size * 0.14))

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <CharacterViewport {...props} />

      {jacket && (
        <span
          data-testid="gear-jacket"
          title={jacket.name}
          className="absolute bottom-[8%] left-[6%] flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-card"
          style={{ backgroundColor: jacket.color, minHeight: badge * 0.7 }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-white/80"
          />
          과잠
          <span className="sr-only">{` — ${jacket.name} 장착 중`}</span>
        </span>
      )}

      {backpack && (
        <span
          data-testid="gear-backpack"
          title={backpack.name}
          className="absolute right-[6%] bottom-[8%] flex items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card"
          style={{ width: badge, height: badge }}
        >
          <Icon name={backpack.icon ?? 'bag'} size={Math.round(badge * 0.6)} />
          <span className="sr-only">{`${backpack.name} 장착 중`}</span>
        </span>
      )}
    </div>
  )
}
