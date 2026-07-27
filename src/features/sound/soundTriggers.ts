import { useSessionStore } from '@/features/sessions/sessionStore'
import { useGameStore } from '@/features/game/gameStore'
import { useRoomStore } from '@/features/rooms/roomStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { xpToStage } from '@/features/progression/growth'
import { playSound } from './soundEngine'
import { useUserStore } from '@/features/onboarding/userStore'

/**
 * 게임·세션·방 상태 변화 → 효과음 이벤트 연결 (단일 설치 지점).
 *
 * 어떤 소리를 실제로 낼지는 soundEngine 이 전역 설정과 모드 sound pack 으로
 * 거릅니다. 여기서는 "무슨 일이 일어났는지"만 알립니다.
 * bad 지속 경고음은 별도로 두지 않습니다 — 회복 기회 알림은 토스트가 담당.
 */
export function installSoundTriggers(): () => void {
  const subs: Array<() => void> = []

  // 세션 시작·완료
  let prevStatus = useSessionStore.getState().status
  subs.push(
    useSessionStore.subscribe((s) => {
      if (s.status === prevStatus) return
      if (s.status === 'running' && prevStatus === 'idle') {
        playSound('session_start')
      }
      if (s.status === 'paused' && prevStatus === 'running') {
        playSound('session_pause')
      }
      if (s.status === 'running' && prevStatus === 'paused') {
        playSound('session_resume')
      }
      if (s.status === 'completed') playSound('session_complete')
      prevStatus = s.status
    }),
  )

  // 내 회복 성공 → 즉시 성공음, 피격 연출 시점(1.4초)에 피격음
  let prevAttack = useGameStore.getState().attackTick
  subs.push(
    useGameStore.subscribe((s) => {
      if (s.attackTick === prevAttack) return
      prevAttack = s.attackTick
      playSound('recovery_success')
      window.setTimeout(() => playSound('boss_hit'), 1400)
    }),
  )

  // 레벨업 (성장 단계 상승)
  let prevStage = xpToStage(useProgressionStore.getState().xp)
  subs.push(
    useProgressionStore.subscribe((s) => {
      const stage = xpToStage(s.xp)
      if (stage > prevStage) playSound('level_up')
      prevStage = stage
    }),
  )

  // 세션 1분 전 알림 (남은 시간이 60초를 지날 때 1회)
  let lastMinuteFor = ''
  subs.push(
    useSessionStore.subscribe((s) => {
      if (s.status !== 'running' || s.plannedMs <= 60_000) return
      const remaining = s.plannedMs - s.elapsedMs
      if (remaining <= 60_000 && lastMinuteFor !== s.sessionId) {
        lastMinuteFor = s.sessionId
        playSound('session_last_minute')
      }
    }),
  )

  // 상점: 구매(보유 아이템 증가)·장착(장착 변경)
  let prevOwned = useProgressionStore.getState().inventory.length
  let prevEquip = JSON.stringify(useProgressionStore.getState().equipped)
  subs.push(
    useProgressionStore.subscribe((s) => {
      const owned = s.inventory.length
      if (owned > prevOwned) playSound('item_purchase')
      prevOwned = owned
      const equip = JSON.stringify(s.equipped)
      if (equip !== prevEquip && prevEquip !== '') playSound('item_equip')
      prevEquip = equip
    }),
  )

  // 친구 방: 입장·준비·반응 수신·기린 싱크·공동 공격
  const room = useRoomStore.getState()
  let prevMembers = room.members.length
  let prevReady = room.members.filter((m) => m.userReady).length
  let seenReactions = new Set(room.reactions.map((r) => r.id))
  let prevSync = room.syncFlashAt
  let prevFriendDone = room.members.some(
    (m) => m.participantId !== room.myId && m.state === 'completed',
  )
  let prevFriendAttack = room.friendAttackTick
  subs.push(
    useRoomStore.subscribe((s) => {
      if (s.members.length > prevMembers) {
        playSound(s.phase === 'running' ? 'friend_reconnect' : 'friend_join')
      }
      if (s.members.length < prevMembers && s.phase === 'running') {
        playSound('friend_disconnect')
      }
      prevMembers = s.members.length

      const friendDone = s.members.some(
        (m) => m.participantId !== s.myId && m.state === 'completed',
      )
      if (friendDone && !prevFriendDone) playSound('friend_complete')
      prevFriendDone = friendDone

      const ready = s.members.filter((m) => m.userReady).length
      if (ready > prevReady) playSound('friend_ready')
      prevReady = ready

      for (const r of s.reactions) {
        if (!seenReactions.has(r.id) && r.participantId !== s.myId) {
          // 상대는 반응 소리를 별도로 끌 수 있습니다.
          if (useUserStore.getState().reactionSoundEnabled) {
            playSound(r.reactionText ? 'custom_reaction' : 'reaction_received')
          }
        }
      }
      seenReactions = new Set(s.reactions.map((r) => r.id))

      if (s.syncFlashAt && s.syncFlashAt !== prevSync) playSound('giraffe_sync')
      prevSync = s.syncFlashAt

      if (s.friendAttackTick !== prevFriendAttack) playSound('coop_attack')
      prevFriendAttack = s.friendAttackTick
    }),
  )

  return () => {
    for (const unsub of subs) unsub()
  }
}
