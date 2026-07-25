import { create } from 'zustand'
import { ROOM_BOSS_MAX_HP, type ReactionKind } from './roomEvents'

/**
 * 친구 방 상태 — Supabase Presence/Broadcast/DB 를 반영하는 로컬 뷰.
 * 개인 자세 상태(bad 등)는 여기에 저장하지 않습니다. 성공 이벤트만 다룹니다.
 */
export type RoomPhase =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'running'
  | 'completed'
  | 'error'

export type RoomConnection = 'connected' | 'reconnecting' | 'offline'

export type MemberState = 'joining' | 'ready' | 'focusing' | 'resting' | 'away' | 'completed'

export interface RoomMember {
  /** 장착 아이템 (성공 이벤트와 함께 공유 허용 항목) */
  jacketId?: string
  backpackId?: string
  cameraReady: boolean
  calibrationReady: boolean
  modelReady: boolean
  userReady: boolean
  participantId: string
  nickname: string
  stage: number
  state: MemberState
  isHost: boolean
}

export interface ReactionFeedItem {
  id: string
  participantId: string
  nickname: string
  reaction: ReactionKind
  at: number
}

interface RoomStoreState {
  phase: RoomPhase
  connection: RoomConnection
  errorMessage: string | null
  roomId: string | null
  code: string | null
  roomName: string
  subject: string
  goal: string
  durationSec: number
  startedAt: number | null
  myId: string | null
  isHost: boolean
  members: RoomMember[]
  bossHp: number
  bossMaxHp: number
  shield: number
  /** 친구 회복 공격 연출 트리거 (수신 시 +1) */
  friendAttackTick: number
  /** 내 카메라 권한 확인 여부 (presence 로만 공유) */
  myCameraReady: boolean
  /** 기린 싱크 연출 트리거 */
  syncFlashAt: number | null
  reactions: ReactionFeedItem[]
  /** 친구의 성공 이벤트 알림 문구 */
  lastFriendEvent: string | null

  patch: (partial: Partial<RoomStoreState>) => void
  addReaction: (item: ReactionFeedItem) => void
  reset: () => void
}

const initialState = {
  phase: 'idle' as RoomPhase,
  connection: 'connected' as RoomConnection,
  errorMessage: null,
  roomId: null,
  code: null,
  roomName: '',
  subject: '',
  goal: '',
  durationSec: 1500,
  startedAt: null,
  myId: null,
  isHost: false,
  members: [] as RoomMember[],
  bossHp: ROOM_BOSS_MAX_HP,
  bossMaxHp: ROOM_BOSS_MAX_HP,
  shield: 0,
  syncFlashAt: null,
  friendAttackTick: 0,
  myCameraReady: false,
  reactions: [] as ReactionFeedItem[],
  lastFriendEvent: null,
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  ...initialState,
  patch: (partial) => set(partial),
  addReaction: (item) =>
    set((s) => ({ reactions: [item, ...s.reactions].slice(0, 4) })),
  reset: () => set({ ...initialState }),
}))
