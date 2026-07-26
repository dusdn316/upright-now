/**
 * 상점 아이템 — 잎사귀 포인트로 구매.
 * 실제 의상 이미지 레이어가 준비되기 전까지는 색 리본·아이콘으로 표시합니다.
 * (equippedJacketId / equippedBackpackId 분리 유지 → 나중에 이미지 레이어로 교체)
 */
export interface ShopItem {
  id: string
  type: 'jacket' | 'backpack'
  name: string
  description: string
  price: number
  /** 과잠 리본 색 (jacket 전용) */
  color?: string
  /** 백팩 아이콘 이름 (backpack 전용, components/ui/Icon) */
  icon?: string
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'jacket-navy',
    type: 'jacket',
    name: '네이비 과잠',
    description: '차분한 캠퍼스의 상징색.',
    price: 240,
    color: '#1F3A5F',
  },
  {
    id: 'jacket-burgundy',
    type: 'jacket',
    name: '버건디 과잠',
    description: '깊고 따뜻한 버건디.',
    price: 240,
    color: '#7A2E3D',
  },
  {
    id: 'jacket-forest',
    type: 'jacket',
    name: '포레스트 과잠',
    description: '숲처럼 편안한 그린.',
    price: 240,
    color: '#2E5D3E',
  },
  {
    id: 'jacket-coral',
    type: 'jacket',
    name: '코랄 과잠',
    description: '눈에 띄는 활력의 코랄.',
    price: 240,
    color: '#FF6464',
  },
  {
    id: 'backpack-freshman',
    type: 'backpack',
    name: '새내기 백팩',
    description: '설렘 가득한 첫 학기.',
    price: 180,
    icon: 'bag',
  },
  {
    id: 'backpack-library',
    type: 'backpack',
    name: '도서관 백팩',
    description: '책과 노트북이 딱 맞게.',
    price: 180,
    icon: 'book',
  },
  {
    id: 'backpack-team',
    type: 'backpack',
    name: '팀플 백팩',
    description: '같이 들면 가볍다.',
    price: 180,
    icon: 'friends',
  },
]

export function getShopItem(id: string | undefined): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id)
}

/** 특별 아이템 — 경제 v2 (350~400P 프리미엄 구간) */
export const SPECIAL_ITEMS: ShopItem[] = [
  {
    id: 'jacket-gold',
    type: 'jacket',
    name: '황금 과잠',
    description: '연속 출석의 상징. 반짝임 주의.',
    price: 400,
    color: '#f2c94c',
  },
  {
    id: 'backpack-galaxy',
    type: 'backpack',
    name: '은하 백팩',
    description: '밤샘의 별들을 담았어요.',
    price: 350,
    icon: 'chart',
  },
]
SPECIAL_ITEMS.forEach((item) => SHOP_ITEMS.push(item))
