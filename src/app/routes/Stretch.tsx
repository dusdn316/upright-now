import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button, Card, Progress } from '@/components/ui'
import { StretchFigure } from '@/components/stretch/StretchFigure'
import { STRETCH_SAFETY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { recommendStretch } from '@/features/stretch/recommend'
import { useActiveModeConfig } from '@/features/modes/modeStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { applyReward } from '@/features/game/rewards'
import { useRoomStore } from '@/features/rooms/roomStore'
import { reportStretchComplete } from '@/features/rooms/roomService'
import { recordCampusContribution } from '@/features/campus/recordContribution'
import { useToast } from '@/app/providers/ToastProvider'
import type { StretchRoutine } from '@/types'

/**
 * 스트레칭 출발 경로 — 어디서 왔는지에 따라 복귀 목적지가 달라집니다.
 * - active-session: 세션 중 휴식. 같은 세션으로 돌아가고 finalize 하지 않습니다.
 * - result: 이미 끝난 세션의 휴식. 결과 화면으로 돌아갑니다.
 * - standalone: 메뉴에서 독립 진입. 세션을 만들지도 끝내지도 않습니다.
 */
type StretchOrigin = 'active-session' | 'result' | 'standalone'

interface StretchLocationState {
  origin?: 'active-session' | 'result'
  sessionId?: string
}

/** S-11 스트레칭 — 모드별 가중 랜덤, 직전 동작 제외, 건너뛰기 불이익 없음 */
export function Stretch() {
  const navigate = useNavigate()
  const location = useLocation()
  const stretchPref = useActiveModeConfig().stretch
  const { push } = useToast()

  const locationState = (location.state ?? {}) as StretchLocationState
  const sessionStatus = useSessionStore((s) => s.status)
  // 새로고침으로 state 가 사라지면(세션 스토어도 함께 초기화됨) standalone 취급.
  const origin: StretchOrigin =
    locationState.origin === 'active-session' && sessionStatus === 'resting'
      ? 'active-session'
      : locationState.origin === 'result'
        ? 'result'
        : 'standalone'
  const originSessionId = locationState.sessionId
  const prevIdRef = useRef<string | undefined>(undefined)
  /**
   * 스트레칭 방문(stretchSessionId) 단위 보상 id — 화면 진입 시 1회만 발급.
   * 다시 시작·다른 동작을 반복해도 같은 id 라 보상은 정확히 1회입니다.
   * 새로고침하면 타이머가 처음부터라 완주 전 보상 자체가 없습니다.
   */
  const stretchSessionIdRef = useRef(
    `stretch-${useSessionStore.getState().sessionId || 'standalone'}-${Date.now()}`,
  )

  const [routine, setRoutine] = useState<StretchRoutine>(() => {
    const first = recommendStretch(stretchPref)
    prevIdRef.current = first.id
    return first
  })
  const [remaining, setRemaining] = useState(routine.durationSec)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (paused || done) return
    if (remaining <= 0) {
      // 타이머 0초 = 완주. 보상은 여기서 주지 않고,
      // 사용자가 '완료하고 돌아가기'를 직접 눌러야 지급됩니다.
      setDone(true)
      return
    }
    // QA 시간 배속(setTimeScale)을 존중합니다. 실사용 기본은 1초.
    const scale = Math.max(1, useSessionStore.getState().timeScale)
    const t = window.setTimeout(
      () => setRemaining((r) => r - 1),
      Math.max(20, Math.round(1000 / scale)),
    )
    return () => window.clearTimeout(t)
  }, [remaining, paused, done])

  const pickAnother = () => {
    const next = recommendStretch(stretchPref, prevIdRef.current)
    prevIdRef.current = next.id
    setRoutine(next)
    setRemaining(next.durationSec)
    setPaused(false)
    setDone(false)
  }

  const restart = () => {
    setRemaining(routine.durationSec)
    setPaused(false)
    setDone(false)
  }

  /** 완주(타이머 0초) 후 '완료하고 돌아가기' — 이때만, 방문당 1회만 보상 */
  const completeAndExit = () => {
    if (!done) return
    const outcome = applyReward({
      id: stretchSessionIdRef.current,
      sessionId: useSessionStore.getState().sessionId,
      type: 'stretch_completed',
    })
    if (outcome.applied) {
      push({
        title: '방어막을 회복했어요! 잠깐의 회복 휴식, 잘했어요.',
        description: `+${outcome.xp} XP · +${outcome.points}P`,
        tone: 'success',
      })
      // 친구 방 공동 방어막은 세션이 실제로 진행 중일 때만 반영합니다.
      // (대기실·종료된 방에서는 방어막을 쌓을 수 없습니다)
      if (useRoomStore.getState().phase === 'running') {
        void reportStretchComplete()
      }
      /*
        캠퍼스 기여도 (+20). 스트레칭 완료 시점을 알 수 있는 곳이 이 화면뿐이라
        여기에서 호출합니다. 플래그가 꺼져 있으면 즉시 무시되고, 보상 계산에는
        어떤 영향도 주지 않습니다.
      */
      void recordCampusContribution({
        kind: 'stretch_completed',
        eventId: `campus-stretch-${stretchSessionIdRef.current}`,
        sessionId: useSessionStore.getState().sessionId,
      })
    }
    exitToOrigin()
  }

  const progress = 1 - remaining / routine.durationSec

  // 출발 경로별 복귀 — 스트레칭은 어떤 경우에도 세션을 끝내지 않습니다.
  const exitToOrigin = () => {
    if (origin === 'active-session') {
      const sessionId =
        originSessionId ?? useSessionStore.getState().sessionId
      useSessionStore.getState().endRest()
      navigate(ROUTES.session(sessionId))
      return
    }
    if (origin === 'result') {
      navigate(
        ROUTES.result(originSessionId ?? useSessionStore.getState().sessionId),
      )
      return
    }
    navigate(ROUTES.home)
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="회복 휴식"
        description={
          origin === 'active-session'
            ? '세션 타이머를 잠시 멈췄어요. 끝나면 하던 세션을 이어서 진행해요.'
            : '오래 앉아 있던 흐름을 짧게 되돌리는 회복 휴식이에요. 건너뛰어도 불이익이 없어요.'
        }
        back={exitToOrigin}
      />

      <div className="mx-auto max-w-xl">
        <Card tone="green">
          <div className="flex flex-col items-center gap-4 text-center">
            <StretchFigure routineId={routine.id} />
            <h2 className="text-xl font-bold text-ink">{routine.name}</h2>
            <p className="text-sm text-ink-soft">{routine.note}</p>

            {done ? (
              <p className="text-base font-bold text-green">완료했어요! 잘하셨어요.</p>
            ) : (
              <div className="w-full">
                <p className="tabular text-3xl font-bold text-ink">{remaining}초</p>
                <div className="mt-2">
                  <Progress value={progress} tone="green" label="스트레칭 진행" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {!done ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setPaused((p) => !p)}>
                  {paused ? '이어서' : '잠시 멈춤'}
                </Button>
                <Button size="sm" variant="secondary" onClick={restart}>
                  다시 시작
                </Button>
                <Button size="sm" variant="secondary" onClick={pickAnother}>
                  다른 동작
                </Button>
                <Button size="sm" variant="ghost" onClick={exitToOrigin}>
                  그만하고 돌아가기
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={completeAndExit}>
                완료하고 돌아가기
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-ink-soft">{STRETCH_SAFETY}</p>
      </div>
    </AppShell>
  )
}
