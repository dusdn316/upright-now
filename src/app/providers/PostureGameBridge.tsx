import { useEffect, useRef } from 'react'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { applyReward } from '@/features/game/rewards'
import { useToast } from './ToastProvider'
import { RECOVERY_COPY } from '@/constants/copy'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import { isRoomSessionActive } from '@/features/rooms/roomStore'
import { MONSTER_THEMES, getActiveModeConfig } from '@/features/modes/modeStore'
import { reportRecovery } from '@/features/rooms/roomService'

/**
 * 자세 엔진 이벤트 → 게임 반응 연결부. UI를 그리지 않습니다.
 *
 * QA Lab 주입과 실제 카메라가 같은 상태 머신·같은 보상 경로를 탑니다.
 * XP·포인트는 applyReward 만 통해 적립됩니다.
 */
export function PostureGameBridge() {
  const lastEvent = usePostureStore((s) => s.lastEvent)
  const { push } = useToast()
  const handledId = useRef<string | null>(null)

  useEffect(() => {
    if (!lastEvent || handledId.current === lastEvent.id) return
    handledId.current = lastEvent.id

    const game = useGameStore.getState()
    const setIntent = useCharacterVisualStore.getState().setIntent

    if (lastEvent.type === 'recovery_started') {
      game.registerOpportunity()
      // 확정 bad 진입 즉시 기회가 열리므로, 아직 움츠린 사용자에게
      // "회복 중" 캐릭터를 보여주지 않습니다. (slouch 유지)
      push({ title: RECOVERY_COPY.inProgress, tone: 'info' })
      return
    }

    if (lastEvent.type === 'recovery_missed') {
      game.recoveryMissed()
      setIntent(null)
      push({ title: RECOVERY_COPY.missed, tone: 'warning' })
      return
    }

    // recovery_succeeded — 전투(피해·콤보)와 보상(XP·포인트)을 분리 적용합니다.
    setIntent(null)
    const { applied } = game.recoverySucceeded(lastEvent.id)
    if (applied === 0) return // 중복 이벤트

    const sessionId = useSessionStore.getState().sessionId
    const reward = applyReward({
      id: `recovery-xp-${lastEvent.id}`,
      sessionId,
      type: 'recovery_success',
    })

    // 친구 방 세션 중이면 공동 보스에도 회복 에너지를 보냅니다. (성공 이벤트만 공유)
    if (isRoomSessionActive()) {
      void reportRecovery()
    }
    const monsterName = isRoomSessionActive()
        ? MONSTER_THEMES.komong.name
        : MONSTER_THEMES[getActiveModeConfig().monsterTheme].name

    push({
      title: RECOVERY_COPY.success,
      description:
        reward.xp > 0
          ? `${monsterName}에게 특수 공격! +${reward.xp} XP`
          : `${monsterName}에게 특수 공격! (이번 세션 XP 보상 상한에 도달했어요)`,
      tone: 'success',
    })
  }, [lastEvent, push])

  return null
}
