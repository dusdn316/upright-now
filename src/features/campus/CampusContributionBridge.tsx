import { useEffect } from 'react'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { isRoomSessionActive } from '@/features/rooms/roomStore'
import { recordCampusContribution } from './recordContribution'

/**
 * 앱 이벤트 → 캠퍼스 기여도 연결부. UI 를 그리지 않습니다.
 *
 * 기존 스토어를 **읽기만** 합니다. 자세 엔진·보상·세션 코어를 고치지 않기 위해
 * 스토어 구독으로만 성공 사실을 관찰합니다.
 *
 * 반영하는 사실:
 * - 세션 status 가 `completed` 로 확정될 때 → 정상 완료 세션 (+100)
 *   같은 세션이 친구 방 세션(mode === 'room')이면 친구 세션 완주 (+50) 도 함께
 * - 자세 회복 성공 이벤트 → 회복 기여 (+20, 세션당 상한)
 *
 * `aborted`(중도 종료) 는 아무것도 반영하지 않습니다.
 * 스트레칭 완주는 화면에서 완료 시점을 알 수 있는 유일한 지점이라
 * `Stretch` 화면에서 직접 호출합니다.
 */
export function CampusContributionBridge() {
  useEffect(() => {
    if (!featureFlags.campusTerritory) return

    let lastStatus = useSessionStore.getState().status
    const unsubSession = useSessionStore.subscribe((state) => {
      const previous = lastStatus
      lastStatus = state.status
      if (previous === 'completed' || state.status !== 'completed') return
      if (useDemoStore.getState().isDemo) return
      // 1분 빠른 점검은 캠퍼스 기여를 만들지 않습니다.
      if (state.lengthId === 'test') return
      // 감지 0초(비데모) 세션은 finalizeSession 이 곧 aborted 로 뒤집습니다.
      // 타이머 tick 이 먼저 completed 를 쏘므로 여기서도 같은 조건으로 거릅니다.
      if (state.detectableMs === 0) return

      const sessionId = state.sessionId
      void recordCampusContribution({
        kind: 'session_completed',
        eventId: `campus-session-${sessionId}`,
        sessionId,
      })
      // 실제 친구 방 세션(4중 검사)일 때만 친구 세션 보너스를 반영합니다.
      if (isRoomSessionActive()) {
        void recordCampusContribution({
          kind: 'friend_session_completed',
          eventId: `campus-friend-${sessionId}`,
          sessionId,
        })
      }
    })

    let lastEventId = usePostureStore.getState().lastEvent?.id ?? null
    const unsubPosture = usePostureStore.subscribe((state) => {
      const event = state.lastEvent
      if (!event || event.id === lastEventId) return
      lastEventId = event.id
      if (event.type !== 'recovery_succeeded') return
      if (useDemoStore.getState().isDemo) return

      const sessionId = useSessionStore.getState().sessionId
      void recordCampusContribution({
        kind: 'posture_recovered',
        eventId: `campus-recovery-${sessionId}-${event.id}`,
        sessionId,
        at: event.at,
      })
    })

    return () => {
      unsubSession()
      unsubPosture()
    }
  }, [])

  return null
}
