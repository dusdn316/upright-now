import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { CharacterWithGear } from '@/components/character/CharacterWithGear'
import { Badge, Button, Card, CardTitle, EmptyState } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { SHOP_ITEMS, type ShopItem } from '@/constants/storeItems'
import { ROUTES } from '@/constants/routes'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { useToast } from '@/app/providers/ToastProvider'

/** S-15 상점 — 잎사귀 포인트로 과잠·백팩 구매·장착 */
export function Shop() {
  const navigate = useNavigate()
  const { push } = useToast()
  const stage = useCharacterStage()
  const points = useProgressionStore((s) => s.points)
  const inventory = useProgressionStore((s) => s.inventory)
  const equipped = useProgressionStore((s) => s.equipped)
  const shopUnlocked = useProgressionStore((s) => s.shopUnlocked)
  const purchaseItem = useProgressionStore((s) => s.purchaseItem)
  const equipItem = useProgressionStore((s) => s.equipItem)

  const buy = (item: ShopItem) => {
    if (points < item.price) {
      push({
        title: '잎사귀 포인트가 조금 더 필요해요.',
        description: '다음 세션을 완료해 볼까요?',
        tone: 'warning',
      })
      return
    }
    if (purchaseItem(item.id, item.price)) {
      push({ title: '새 아이템을 얻었어요.', description: item.name, tone: 'success' })
    }
  }

  const toggleEquip = (item: ShopItem) => {
    const current = item.type === 'jacket' ? equipped.jacketId : equipped.backpackId
    equipItem(item.type, current === item.id ? undefined : item.id)
    if (current !== item.id) {
      push({ title: '캐릭터에게 잘 어울려요!', description: item.name, tone: 'success' })
    }
  }

  if (!shopUnlocked) {
    return (
      <AppShell>
        <PageHeader
          title="상점"
          description="모은 잎사귀로 대학 컬러 과잠과 캠퍼스 백팩을 고를 수 있어요."
          back={ROUTES.home}
        />
        <EmptyState
          title="첫 세션을 완료하면 상점이 열려요"
          description="집중 세션을 한 번 완주하면 잎사귀 포인트와 함께 상점이 잠금 해제돼요."
          action={
            <Button size="sm" onClick={() => navigate(ROUTES.sessionSetup)}>
              집중 세션 시작
            </Button>
          }
        />
      </AppShell>
    )
  }

  const jackets = SHOP_ITEMS.filter((i) => i.type === 'jacket')
  const backpacks = SHOP_ITEMS.filter((i) => i.type === 'backpack')

  const renderItem = (item: ShopItem) => {
    const owned = inventory.includes(item.id)
    const isEquipped =
      (item.type === 'jacket' ? equipped.jacketId : equipped.backpackId) === item.id
    const affordable = points >= item.price

    return (
      <Card
        key={item.id}
        className={['min-h-[170px]', isEquipped ? 'ring-2 ring-pink/50' : ''].join(' ')}
      >
        <div className="flex min-w-0 items-start gap-3">
          {/*
            구매 전에도 현재 캐릭터 단계가 이 아이템만 착용한 실제 모습.
            preview 는 progression store 를 읽기만 하며 절대 바꾸지 않습니다.
            이미지 실패 시 CharacterWithGear 가 기존 색·아이콘 폴백을 씁니다.
          */}
          <div
            data-testid={`shop-preview-${item.id}`}
            className="h-[88px] w-[88px] shrink-0 sm:h-[112px] sm:w-[112px]"
          >
            <div className="origin-top-left scale-[0.7857] sm:scale-100">
              <CharacterWithGear
                stage={stage}
                size={112}
                ignoreCurrentlyEquipped
                previewJacketId={item.type === 'jacket' ? item.id : null}
                previewBackpackId={item.type === 'backpack' ? item.id : null}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-ink">{item.name}</p>
              {isEquipped ? (
                <Badge tone="pink">장착 중</Badge>
              ) : owned ? (
                <Badge tone="green">보유</Badge>
              ) : (
                <Badge tone="yellow">
                  <Icon name="leaf" size={12} />
                  {`${item.price}P`}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">{item.description}</p>

            <div className="mt-auto pt-3">
              {!owned ? (
                <Button size="sm" fullWidth disabled={!affordable} onClick={() => buy(item)}>
                  {affordable ? '구매' : '포인트 부족'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  fullWidth
                  variant={isEquipped ? 'secondary' : 'primary'}
                  onClick={() => toggleEquip(item)}
                >
                  {isEquipped ? '장착 해제' : '장착'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <AppShell
      rail={
        <Card tone="green" className="p-4">
          <CardTitle>미리보기</CardTitle>
          <div className="mt-2 flex justify-center">
            <CharacterWithGear stage={stage} size={220} />
          </div>
          <p className="mt-2 text-center text-xs text-ink-soft">
            장착한 과잠·백팩이 캐릭터에 표시돼요.
          </p>
        </Card>
      }
    >
      <PageHeader
        title="상점"
        description="모은 잎사귀로 캠퍼스 스타일을 골라보세요."
        back={ROUTES.home}
        action={
          <Badge tone="yellow" className="text-sm">
            <Icon name="leaf" size={14} />
            {`${points}P`}
          </Badge>
        }
      />

      <section className="mb-5">
        <h2 className="mb-2 text-lg font-bold text-ink">대학 컬러 과잠</h2>
        <div className="grid gap-3 sm:grid-cols-2">{jackets.map(renderItem)}</div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-ink">캠퍼스 백팩</h2>
        <div className="grid gap-3 sm:grid-cols-2">{backpacks.map(renderItem)}</div>
      </section>
    </AppShell>
  )
}
