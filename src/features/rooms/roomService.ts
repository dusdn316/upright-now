import type { RealtimeChannel } from '@supabase/supabase-js'
import { ensureAnonymousUser, getSupabase } from '@/lib/supabase/client'
import {
  generateRoomCode,
  sanitizeRoomEvent,
  ROOM_DAMAGE,
  ROOM_SHIELD_PER_STRETCH,
  type ReactionKind,
  type RoomEvent,
} from './roomEvents'
import { createGiraffeSync, deriveSyncEventId, registerRecovery } from './giraffeSync'
import { useRoomStore, type MemberState } from './roomStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { xpToStage } from '@/features/progression/growth'
import { useProgressionStore } from '@/features/progression/progressionStore'

/**
 * 친구 방 서비스 — Supabase 익명 인증 · RPC · Presence · Broadcast.
 *
 * 전송하는 것: 닉네임 · 참가 상태 · 성공 이벤트(회복/스트레칭/완료/응원)뿐입니다.
 * 카메라 영상·프레임·랜드마크·자세 좌표·bad 상태는 절대 전송하지 않습니다.
 * 보스 HP 는 DB(rooms.boss_hp)가 최종 기준이며 RPC 로만 원자적으로 줄입니다.
 */
let channel: RealtimeChannel | null = null
let giraffe = createGiraffeSync()
let reconnectTimer: number | null = null
let pollTimer: number | null = null
let reconnectDeadline = 0

const store = () => useRoomStore.getState()

function myPresence(state: MemberState) {
  return {
    participantId: store().myId ?? '',
    nickname: useUserStore.getState().nickname,
    stage: xpToStage(useProgressionStore.getState().xp),
    state,
    isHost: store().isHost,
  }
}

async function refreshRoomRow(roomId: string): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase) return
  const { data } = await supabase
    .from('rooms')
    .select('status, boss_hp, boss_max_hp, shield, started_at, duration_seconds')
    .eq('id', roomId)
    .single()
  if (!data) return
  store().patch({
    bossHp: data.boss_hp,
    bossMaxHp: data.boss_max_hp,
    shield: data.shield ?? 0,
    durationSec: data.duration_seconds,
    startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
    phase:
      data.status === 'running'
        ? 'running'
        : data.status === 'completed' || data.status === 'closed'
          ? 'completed'
          : 'waiting',
  })
}

function handleEvent(event: RoomEvent): void {
  const s = store()
  if (event.type === 'reaction_sent' && event.reaction) {
    s.addReaction({
      id: event.id,
      nickname: event.nickname,
      reaction: event.reaction,
      at: Date.now(),
    })
    return
  }

  const isMine = event.participantId === s.myId

  // 성공 이벤트가 오면 곧 DB HP·방어막이 바뀌므로 잠시 후 재조회합니다.
  if (event.type !== 'reaction_sent' && s.roomId) {
    const roomId = s.roomId
    window.setTimeout(() => void refreshRoomRow(roomId), 800)
  }

  if (event.type === 'recovery_earned') {
    if (!isMine) {
      s.patch({ lastFriendEvent: `${event.nickname}님이 회복 에너지를 보냈어요.` })
    }
    const result = registerRecovery(giraffe, {
      eventId: event.id,
      participantId: event.participantId,
      timestamp: event.timestamp,
    })
    giraffe = result.state
    if (result.sync && result.pairIds && s.roomId) {
      s.patch({ syncFlashAt: Date.now() })
      // 두 클라이언트가 같은 결정적 event_id(파생 uuid)로 호출 → DB 가 1회만 적용.
      // 원본 회복 id 를 재사용하면 dedup 테이블과 충돌하므로 파생 id 를 씁니다.
      const syncId = deriveSyncEventId(result.pairIds[0], result.pairIds[1])
      void applyDamageRpc(s.roomId, syncId, 'giraffe_sync', ROOM_DAMAGE.giraffeSync)
    }
    return
  }

  if (event.type === 'session_completed' && !isMine) {
    s.patch({ lastFriendEvent: `${event.nickname}님이 세션을 완주했어요.` })
  }
  if (event.type === 'stretch_completed' && !isMine) {
    s.patch({ lastFriendEvent: `${event.nickname}님이 스트레칭으로 방어막을 채웠어요.` })
  }
}

async function applyDamageRpc(
  roomId: string,
  eventId: string,
  eventType: 'recovery_earned' | 'session_completed' | 'giraffe_sync',
  damage: number,
): Promise<void> {
  const supabase = await getSupabase()
  if (!supabase) return
  const { data } = await supabase.rpc('apply_room_damage', {
    p_room_id: roomId,
    p_event_id: eventId,
    p_event_type: eventType,
    p_damage: damage,
  })
  if (typeof data === 'number') store().patch({ bossHp: data })
}

async function broadcast(event: RoomEvent): Promise<void> {
  const safe = sanitizeRoomEvent(event)
  if (!safe || !channel) return
  await channel.send({ type: 'broadcast', event: 'room_event', payload: safe })
}

function startPolling(roomId: string): void {
  if (pollTimer) window.clearInterval(pollTimer)
  // postgres_changes publication 이 없는 프로젝트에서도 상태·HP 가 따라오도록 폴링합니다.
  pollTimer = window.setInterval(() => {
    const phase = store().phase
    if (phase === 'waiting' || phase === 'running') void refreshRoomRow(roomId)
  }, 3000)
}

function subscribeChannel(roomId: string, code: string): void {
  startPolling(roomId)
  void (async () => {
    const supabase = await getSupabase()
    if (!supabase) return

    channel = supabase.channel(`room:${code}`, {
      // private 채널은 realtime.messages RLS 정책이 필요합니다. 현재 스키마에는 없어
      // 표준 채널을 씁니다. 방 데이터 자체는 테이블 RLS + RPC 검증으로 보호됩니다.
      config: { presence: { key: store().myId ?? undefined } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const presence = channel?.presenceState() ?? {}
        // track() 재호출 시 메타가 누적될 수 있어 participantId 기준
        // "마지막 메타"만 남깁니다. (준비 상태 갱신이 옛 메타에 가려지는 것 방지)
        const byId = new Map<string, ReturnType<typeof myPresence>>()
        for (const raw of Object.values(presence).flat()) {
          const m = raw as unknown as ReturnType<typeof myPresence>
          if (m.participantId) byId.set(m.participantId, m)
        }
        const members = [...byId.values()].map((m) => ({
          participantId: m.participantId,
          nickname: m.nickname,
          stage: m.stage,
          state: m.state,
          isHost: m.isHost,
        }))
        store().patch({ members })
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        const safe = sanitizeRoomEvent(payload)
        if (safe) handleEvent(safe)
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => void refreshRoomRow(roomId),
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          store().patch({ connection: 'connected' })
          await channel?.track(myPresence('joining'))
          await refreshRoomRow(roomId)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect(roomId, code)
        }
      })
  })()
}

/** 연결 끊김 → 30초 재시도. 실패하면 offline (개인 세션은 계속). */
function scheduleReconnect(roomId: string, code: string): void {
  const s = store()
  if (s.phase === 'idle') return
  if (s.connection !== 'reconnecting') {
    reconnectDeadline = Date.now() + 30_000
    s.patch({ connection: 'reconnecting' })
  }
  if (Date.now() > reconnectDeadline) {
    s.patch({ connection: 'offline' })
    return
  }
  if (reconnectTimer) window.clearTimeout(reconnectTimer)
  reconnectTimer = window.setTimeout(() => {
    void channel?.unsubscribe()
    subscribeChannel(roomId, code)
  }, 3000)
}

/* -------------------------------- 공개 API ------------------------------- */

export async function createRoom(input: {
  roomName: string
  subject: string
  goal: string
  durationSec: number
}): Promise<{ ok: boolean; code?: string; message?: string }> {
  const s = store()
  s.patch({ phase: 'connecting', errorMessage: null })

  const userId = await ensureAnonymousUser()
  const supabase = await getSupabase()
  if (!userId || !supabase) {
    s.patch({ phase: 'error', errorMessage: '연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    return { ok: false, message: 'not-configured' }
  }

  const code = generateRoomCode()
  const { data, error } = await supabase.rpc('create_room', {
    p_code: code,
    p_nickname: useUserStore.getState().nickname,
    p_subject: input.subject || null,
    p_goal: input.goal || null,
    p_duration_seconds: input.durationSec,
  })

  if (error || !data) {
    s.patch({ phase: 'error', errorMessage: '방을 만들지 못했어요. 다시 시도해 주세요.' })
    return { ok: false, message: error?.message }
  }

  giraffe = createGiraffeSync()
  s.patch({
    phase: 'waiting',
    roomId: data as string,
    code,
    roomName: input.roomName,
    subject: input.subject,
    goal: input.goal,
    durationSec: input.durationSec,
    myId: userId,
    isHost: true,
  })
  subscribeChannel(data as string, code)
  return { ok: true, code }
}

export async function joinRoom(
  code: string,
): Promise<{ ok: boolean; message?: string }> {
  const s = store()
  s.patch({ phase: 'connecting', errorMessage: null })

  const userId = await ensureAnonymousUser()
  const supabase = await getSupabase()
  if (!userId || !supabase) {
    s.patch({ phase: 'error', errorMessage: '연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    return { ok: false, message: 'not-configured' }
  }

  const { data, error } = await supabase.rpc('join_room', {
    p_code: code.toUpperCase(),
    p_nickname: useUserStore.getState().nickname,
  })

  if (error || !data) {
    const message = error?.message ?? ''
    const friendly = message.includes('not found')
      ? '방을 찾지 못했어요. 코드를 다시 확인해 주세요.'
      : message.includes('full')
        ? '이 방은 이미 두 명이 참여하고 있어요.'
        : message.includes('waiting')
          ? '이미 시작되었거나 종료된 방이에요.'
          : '입장하지 못했어요. 다시 시도해 주세요.'
    s.patch({ phase: 'error', errorMessage: friendly })
    return { ok: false, message: friendly }
  }

  giraffe = createGiraffeSync()
  s.patch({
    phase: 'waiting',
    roomId: data as string,
    code: code.toUpperCase(),
    myId: userId,
    isHost: false,
  })
  subscribeChannel(data as string, code.toUpperCase())
  return { ok: true }
}

export async function setMyState(state: MemberState): Promise<void> {
  await channel?.track(myPresence(state))
}

/** 방장만 시작 — 두 명 모두 ready 인지 확인은 UI 가 담당합니다. */
export async function startRoomSession(): Promise<boolean> {
  const s = store()
  const supabase = await getSupabase()
  if (!supabase || !s.roomId || !s.isHost) return false

  const { error } = await supabase
    .from('rooms')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', s.roomId)
  if (error) return false
  await setMyState('focusing')
  return true
}

export async function reportRecovery(): Promise<void> {
  const s = store()
  if (s.phase !== 'running' || !s.roomId || !s.myId) return
  const eventId = crypto.randomUUID()
  const event: RoomEvent = {
    id: eventId,
    type: 'recovery_earned',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    timestamp: Date.now(),
  }
  handleEvent(event) // 내 화면에도 즉시 반영 (기린 싱크 감지 포함)
  await broadcast(event)
  await applyDamageRpc(s.roomId, eventId, 'recovery_earned', ROOM_DAMAGE.recovery)
}

export async function reportStretchComplete(): Promise<void> {
  const s = store()
  if (!s.roomId || !s.myId) return
  const eventId = crypto.randomUUID()
  await broadcast({
    id: eventId,
    type: 'stretch_completed',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    timestamp: Date.now(),
  })
  const supabase = await getSupabase()
  if (!supabase) return
  const { data } = await supabase.rpc('apply_room_shield', {
    p_room_id: s.roomId,
    p_event_id: eventId,
    p_amount: ROOM_SHIELD_PER_STRETCH,
  })
  if (typeof data === 'number') s.patch({ shield: data })
}

export async function reportSessionComplete(): Promise<void> {
  const s = store()
  if (!s.roomId || !s.myId) return
  const eventId = crypto.randomUUID()
  await broadcast({
    id: eventId,
    type: 'session_completed',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    timestamp: Date.now(),
  })
  await setMyState('completed')
  await applyDamageRpc(s.roomId, eventId, 'session_completed', ROOM_DAMAGE.sessionCompleted)
}

export async function sendReaction(reaction: ReactionKind): Promise<void> {
  const s = store()
  if (!s.roomId || !s.myId) return
  const event: RoomEvent = {
    id: crypto.randomUUID(),
    type: 'reaction_sent',
    participantId: s.myId,
    nickname: useUserStore.getState().nickname,
    reaction,
    timestamp: Date.now(),
  }
  handleEvent(event)
  await broadcast(event)
}

export async function leaveRoom(): Promise<void> {
  if (reconnectTimer) window.clearTimeout(reconnectTimer)
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
  await channel?.unsubscribe()
  channel = null
  giraffe = createGiraffeSync()
  store().reset()
}
