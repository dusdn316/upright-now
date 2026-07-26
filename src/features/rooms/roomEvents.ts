/**
 * 친구 방 이벤트 — 허용 스키마 밖 데이터는 전송하지 않습니다.
 *
 * 절대 전송 금지: 카메라 영상·사진·프레임·랜드마크·자세 좌표·bad 상태·
 * 나쁜 자세 지속 시간·개인 자세 점수·개인 기준. (docs/08 §8)
 */
export type RoomEventType =
  | 'recovery_earned'
  | 'stretch_completed'
  | 'session_completed'
  | 'reaction_sent'

export type ReactionKind = 'cheer' | 'reset' | 'done'

export interface RoomEvent {
  id: string
  type: RoomEventType
  participantId: string
  nickname: string
  reaction?: ReactionKind
  /** 커스텀 응원 문구 — 최대 16자, sanitize 후 Broadcast (DB 저장 없음) */
  reactionText?: string
  timestamp: number
}

export const REACTION_LABEL: Record<ReactionKind, string> = {
  cheer: '조금만 더',
  reset: '같이 리셋하자',
  done: '나도 완료했어',
}

/** 공동 보스 수치 — docs Gate2 */
export const ROOM_BOSS_MAX_HP = 2000
export const ROOM_DAMAGE = {
  recovery: 40,
  sessionCompleted: 100,
  giraffeSync: 60,
} as const
export const ROOM_SHIELD_PER_STRETCH = 15

const ALLOWED_KEYS = new Set([
  'id',
  'type',
  'participantId',
  'nickname',
  'reaction',
  'reactionText',
  'timestamp',
])

const ALLOWED_TYPES: RoomEventType[] = [
  'recovery_earned',
  'stretch_completed',
  'session_completed',
  'reaction_sent',
]

/**
 * 이벤트 payload 검증 — 허용 필드·타입만 통과시킵니다.
 * 자세 좌표·상태 같은 필드가 섞여 들어오면 null 을 돌려 전송/수신을 막습니다.
 */
export function sanitizeRoomEvent(raw: unknown): RoomEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) return null
  }

  if (typeof obj.id !== 'string' || obj.id.length === 0) return null
  if (!ALLOWED_TYPES.includes(obj.type as RoomEventType)) return null
  if (typeof obj.participantId !== 'string') return null
  if (typeof obj.timestamp !== 'number') return null

  const nickname =
    typeof obj.nickname === 'string' ? obj.nickname.slice(0, 12) : ''

  if (obj.type === 'reaction_sent') {
    if (!['cheer', 'reset', 'done'].includes(obj.reaction as string)) return null
  }

  const reactionText =
    typeof obj.reactionText === 'string'
      ? sanitizeReactionText(obj.reactionText)
      : undefined

  return {
    id: obj.id,
    type: obj.type as RoomEventType,
    participantId: obj.participantId,
    nickname,
    reaction: obj.reaction as ReactionKind | undefined,
    reactionText: reactionText || undefined,
    timestamp: obj.timestamp,
  }
}

/** 응원 문구 정리 — HTML 태그·괄호·제어문자 제거, 최대 16자 */
export function sanitizeReactionText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
}

/** 6자리 영문 대문자·숫자 방 코드 */
export function generateRoomCode(rand: () => number = Math.random): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(rand() * chars.length)]
  }
  return code
}
