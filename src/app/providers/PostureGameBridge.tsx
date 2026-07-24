import { useEffect, useRef } from 'react'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useToast } from './ToastProvider'
import { RECOVERY_COPY } from '@/constants/copy'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'

/**
 * 자세 엔진 이벤트 → 게임 반응 연결부. UI를 그리지 않습니다.
 *
 * QA Lab이 어느 화면에서 상태를 바꾸든 같은 경로를 타도록 앱 최상단에 둡니다.
 * Phase 3에서 MediaPipe가 같은 이벤트를 내보내면 이 파일은 수정하지 않습니다.
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
      // 회복 기회가 열리면 캐릭터가 "회복 중" 표현을 보입니다. (recover.webp)
      setIntent('recover')
      push({ title: RECOVERY_COPY.inProgress, tone: 'info' })
      return
    }

    if (lastEvent.type === 'recovery_missed') {
      game.recoveryMissed()
      setIntent(null)
      push({ title: RECOVERY_COPY.missed, tone: 'warning' })
      return
    }

    // recovery_succeeded — 공격 연출은 attackTick 이 담당하고, 끝나면 idle 로 돌아갑니다.
    setIntent(null)
    const { xp } = game.recoverySucceeded(lastEvent.id)
    if (xp > 0) {
      useProgressionStore.getState().addXp(xp)
      useProgressionStore.getState().addPoints(3)
    }

    push({
      title: RECOVERY_COPY.success,
      description:
        xp > 0
          ? `마감괴수에게 특수 공격! +${xp} XP`
          : '마감괴수에게 특수 공격! (이번 세션 XP 보상 상한에 도달했어요)',
      tone: 'success',
    })
  }, [lastEvent, push])

  return null
}
