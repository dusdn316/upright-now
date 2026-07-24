import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { BossHealthBar } from '@/components/game/BossHealthBar'
import {
  PostureMessage,
  PostureStatusBadge,
} from '@/components/posture/PostureStatusBadge'
import { RecoveryCombo, SessionTimer } from '@/components/session/SessionBits'
import { Badge, Button, Card, CardTitle, StatTile } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { AWAY_PROMPT_MS } from '@/constants/posture'
import { AWAY_PROMPT } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { remainingMs } from '@/features/sessions/sessionMachine'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import { usePostureTicker } from '@/features/posture-engine/usePostureTicker'
import { useLiveClassifier } from '@/features/posture-engine/useLiveClassifier'
import { useCamera } from '@/features/calibration/useCamera'
import { useGameStore } from '@/features/game/gameStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { buildSessionSummary } from '@/features/sessions/buildSummary'
import { featureFlags } from '@/lib/feature-flags/flags'

/**
 * S-09 집중 세션 — 사이드바를 숨기고 대시보드보다 단순하게 (docs/04 §3, docs/05 S-09)
 *
 * 화면 구성:
 *   왼쪽  캐릭터(가장 큼) + 자세 문구 + 마감괴수 체력
 *   오른쪽 남은 시간 · 이번 세션 결과 · 제어 버튼
 */
export function Session() {
  const navigate = useNavigate()
  const { sessionId = 'demo' } = useParams()
  const videoRef = useRef<HTMLVideoElement>(null)

  const stage = useCharacterStage()
  const soundEnabled = useUserStore((s) => s.soundEnabled)
  const toggleSound = useUserStore((s) => s.toggleSound)
  const hasCalibration = useUserStore((s) => s.hasCalibration)
  const isDemo = useDemoStore((s) => s.isDemo)
  const snapshot = usePostureStore((s) => s.snapshot)
  const visualIntent = useCharacterVisualStore((s) => s.intent)
  const session = useSessionStore()
  const game = useGameStore()
  const completeSession = useProgressionStore((s) => s.completeSession)
  const completedRef = useRef(false)

  const isBad = snapshot.state === 'bad'

  // 실제 카메라 자세 감지: 카메라 기능이 켜지고, 기준이 등록됐고, 데모가 아닐 때만.
  const useRealCamera = featureFlags.camera && hasCalibration && !isDemo
  const { state: camera, start: startCamera, stop: stopCamera } =
    useCamera(videoRef)
  useLiveClassifier(videoRef, camera)

  // 회복 수명주기를 굴리는 상태 머신 티커 (카메라·QA 공통)
  usePostureTicker(true)

  // 세션이 시작되면 카메라를 켜고, 화면을 떠나면 트랙을 정지합니다.
  useEffect(() => {
    if (useRealCamera && session.status === 'running') startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRealCamera, session.status === 'running'])

  useEffect(() => stopCamera, [stopCamera])

  // 1초 틱. 자세로 집중 여부를 추론하지 않고, 시작 시점부터 시간만 잽니다.
  useEffect(() => {
    if (session.status !== 'running') return
    const timer = window.setInterval(() => {
      useSessionStore
        .getState()
        .tick(1000, usePostureStore.getState().snapshot.state)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [session.status])

  // 세션 완주 → 기본 공격 1회 + 장기 보상 적립 + 기록 저장 (중복 방지)
  useEffect(() => {
    if (session.status !== 'completed' || completedRef.current) return
    completedRef.current = true

    useGameStore
      .getState()
      .sessionCompleted(`session-complete-${session.sessionId}`)
    const earned = useGameStore.getState()
    const dateKey = new Date().toISOString().slice(0, 10)
    completeSession(earned.sessionXp, earned.sessionPoints, dateKey)
    if (!isDemo) {
      useSessionHistoryStore
        .getState()
        .add(buildSessionSummary(useSessionStore.getState(), earned, 'completed'))
    }
    stopCamera()
  }, [session.status, session.sessionId, completeSession, isDemo, stopCamera])

  const remaining = remainingMs(session)
  const showAwayPrompt =
    snapshot.state === 'away' && session.awayMs >= AWAY_PROMPT_MS

  const endSession = () => {
    session.finish('aborted')
    if (!isDemo && session.elapsedMs > 0) {
      useSessionHistoryStore
        .getState()
        .add(
          buildSessionSummary(
            useSessionStore.getState(),
            useGameStore.getState(),
            'aborted',
          ),
        )
    }
    stopCamera()
    navigate(ROUTES.result(sessionId))
  }

  return (
    <AppShell chrome="focus">
      {/* 자세 분석용 비디오. 화면에 크게 노출하지 않습니다. (docs/05 S-09) */}
      {useRealCamera && (
        <video
          ref={videoRef}
          playsInline
          muted
          className="pointer-events-none fixed bottom-3 right-3 h-24 w-32 -scale-x-100 rounded-xl border border-line object-cover opacity-80"
        />
      )}

      {/* 상단 — 과목·목표만 간결하게 */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-soft">
            {session.subject || '집중 세션'}
          </p>
          <h1 className="truncate text-2xl font-bold text-ink">
            {session.goal || '오늘의 목표를 끝내는 시간'}
          </h1>
        </div>
        <PostureStatusBadge state={snapshot.state} quality={snapshot.quality} />
      </header>

      {session.status === 'idle' && (
        <Card tone="blue" className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              시간은 시작 버튼을 누른 시점부터 재요.
            </p>
            <Button
              size="sm"
              onClick={() => {
                useGameStore.getState().reset()
                session.start(sessionId)
              }}
            >
              <Icon name="play" size={16} />이 세션 시작하기
            </Button>
          </div>
        </Card>
      )}

      {showAwayPrompt && (
        <Card tone="yellow" className="mb-4 p-4">
          <p className="text-sm font-bold text-ink">{AWAY_PROMPT.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => usePostureStore.getState().setPostureState('good')}
            >
              계속하기
            </Button>
            <Button size="sm" variant="secondary" onClick={() => session.pause()}>
              일시정지
            </Button>
            <Button size="sm" variant="ghost" onClick={endSession}>
              세션 종료
            </Button>
          </div>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 왼쪽 — 캐릭터가 가장 먼저 보이고, 바로 아래 보스 체력 */}
        <Card
          tone={isBad ? 'coral' : 'pink'}
          className="transition-colors duration-300"
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <CharacterViewport
              stage={stage}
              postureState={snapshot.state}
              visualState={visualIntent ?? 'idle'}
              attackTick={game.attackTick}
              size={270}
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <PostureMessage state={snapshot.state} />
              <p className="mt-2 text-sm text-ink-soft">
                처음 등록한 개인 기준과 비교한 변화만 알려드려요.
              </p>
              <div className="mt-5 flex justify-center sm:justify-start">
                <RecoveryCombo combo={game.combo} best={game.bestCombo} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-surface/80 p-4">
            <BossHealthBar
              hp={game.boss.hp}
              maxHp={game.boss.maxHp}
              attackTick={game.attackTick}
            />
          </div>
        </Card>

        {/* 오른쪽 — 남은 시간 · 이번 세션 · 제어 */}
        <div className="flex flex-col gap-3">
          <Card className="p-5">
            <SessionTimer remaining={remaining} />
          </Card>

          <Card className="p-5">
            <CardTitle>이번 세션</CardTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatTile
                label="회복 성공"
                value={String(game.recoveries)}
                unit="회"
                tone="canvas"
              />
              <StatTile
                label="회복 기회"
                value={String(game.opportunities)}
                unit="회"
                tone="canvas"
              />
              <StatTile label="획득 XP" value={String(game.sessionXp)} tone="canvas" />
              <StatTile
                label="잎사귀"
                value={String(game.sessionPoints)}
                unit="P"
                tone="canvas"
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={toggleSound}>
                {soundEnabled ? '소리 끄기' : '소리 켜기'}
              </Button>
              <Button size="sm" variant="secondary" disabled>
                미니 위젯
                <Badge tone="muted">준비 중</Badge>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(ROUTES.stretch())}
              >
                스트레칭 예약
              </Button>
              {session.status === 'running' ? (
                <Button size="sm" variant="ghost" onClick={() => session.pause()}>
                  일시정지
                </Button>
              ) : session.status === 'paused' ? (
                <Button size="sm" variant="ghost" onClick={() => session.resume()}>
                  이어서 하기
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={endSession}>
                세션 종료
              </Button>
            </div>
          </Card>

          {session.status === 'completed' && (
            <Card tone="green" className="p-5">
              <p className="text-base font-bold text-ink">
                오늘의 세션을 마쳤어요.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                마감괴수에게 기본 공격이 들어갔어요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(ROUTES.stretch())}>
                  <Icon name="stretch" size={16} />2분 리셋 하기
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(ROUTES.result(sessionId))}
                >
                  결과 보기
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}
