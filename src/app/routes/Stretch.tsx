import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button, Card, Progress } from '@/components/ui'
import { StretchFigure } from '@/components/stretch/StretchFigure'
import { STRETCH_SAFETY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { recommendStretch } from '@/features/stretch/recommend'
import { useUserStore } from '@/features/onboarding/userStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { applyReward } from '@/features/game/rewards'
import { useRoomStore } from '@/features/rooms/roomStore'
import { reportStretchComplete } from '@/features/rooms/roomService'
import { useToast } from '@/app/providers/ToastProvider'
import type { StretchRoutine } from '@/types'

let attemptSeq = 0

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
  const profileId = useUserStore((s) => s.profileId)
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
   * 완료 보상 이벤트 id — 시도(동작 시작)마다 한 번만 만들어,
   * 같은 완료가 두 번 보상되지 않게 합니다. (applyReward 가 id 로 중복 차단)
   */
  const attemptIdRef = useRef('')

  const newAttempt = (routineId: string) => {
    attemptSeq += 1
    attemptIdRef.current = `stretch-${useSessionStore.getState().sessionId}-${routineId}-${attemptSeq}`
  }

  const [routine, setRoutine] = useState<StretchRoutine>(() => {
    const first = recommendStretch(profileId)
    prevIdRef.current = first.id
    newAttempt(first.id)
    return first
  })
  const [remaining, setRemaining] = useState(routine.durationSec)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (paused || done) return
    if (remaining <= 0) {
      finish()
      return
    }
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, paused, done])

  const pickAnother = () => {
    const next = recommendStretch(profileId, prevIdRef.current)
    prevIdRef.current = next.id
    newAttempt(next.id)
    setRoutine(next)
    setRemaining(next.durationSec)
    setPaused(false)
    setDone(false)
  }

  const restart = () => {
    // 같은 동작을 처음부터 — 새 시도로 취급합니다.
    newAttempt(routine.id)
    setRemaining(routine.durationSec)
    setPaused(false)
    setDone(false)
  }

  const finish = () => {
    if (done) return
    setDone(true)
    // 완료 보상 — 반드시 applyReward 를 통해서만. 같은 시도는 1회만 적립됩니다.
    const outcome = applyReward({
      id: attemptIdRef.current,
      sessionId: useSessionStore.getState().sessionId,
      type: 'stretch_completed',
    })
    if (outcome.applied) {
      push({
        title: '방어막을 회복했어요! 잠깐의 리셋, 잘했어요.',
        description: `+${outcome.xp} XP · +${outcome.points}P`,
        tone: 'success',
      })
      // 친구 방이면 공동 방어막에도 반영합니다.
      if (useRoomStore.getState().roomId) {
        void reportStretchComplete()
      }
    }
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

  const exitLabel =
    origin === 'active-session'
      ? '세션으로 돌아가기'
      : origin === 'result'
        ? '결과로 돌아가기'
        : '홈으로'

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="2분 리셋"
        description={
          origin === 'active-session'
            ? '세션 타이머를 잠시 멈췄어요. 끝나면 하던 세션을 이어서 진행해요.'
            : '오래 앉아 있던 흐름을 짧게 리셋해요. 건너뛰어도 불이익이 없어요.'
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
            {!done && (
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
                <Button size="sm" onClick={finish}>
                  완료
                </Button>
              </>
            )}
            {done && (
              <Button size="sm" variant="secondary" onClick={pickAnother}>
                다른 동작 보기
              </Button>
            )}
            <Button
              size="sm"
              variant={done ? 'primary' : 'ghost'}
              onClick={exitToOrigin}
            >
              {done ? exitLabel : '건너뛰기'}
            </Button>
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-ink-soft">{STRETCH_SAFETY}</p>
      </div>
    </AppShell>
  )
}
