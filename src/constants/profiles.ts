import type { LearningProfile } from '@/types'

/** 학습 프로필 — docs/02_PRD.md FR-002, docs/13 §4 */
export const LEARNING_PROFILES: LearningProfile[] = [
  {
    id: 'library',
    name: '도서관',
    description: '소리 없이, 작은 화면으로 조용히 알려드려요.',
    sound: '무음',
    ambient: '작은 신호',
    stretchKind: '앉아서 하는 동작',
    accent: 'blue',
    icon: 'book',
  },
  {
    id: 'home',
    name: '내 공간',
    description: '캐릭터와 소리를 더 풍부하게 사용할 수 있어요.',
    sound: '선택적 사운드',
    ambient: '풍부한 연출',
    stretchKind: '전신 동작',
    accent: 'pink',
    icon: 'headphones',
  },
  {
    id: 'team',
    name: '팀플',
    description: '친구와 공동 보스를 공략하고 함께 회복 휴식해요.',
    sound: '선택적 사운드',
    ambient: '공동 보스 연출',
    stretchKind: '같이 하기 쉬운 동작',
    accent: 'yellow',
    icon: 'friends',
  },
]

export const DEFAULT_PROFILE_ID = 'library' as const
