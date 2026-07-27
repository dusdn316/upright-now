import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { CharacterWithGear } from '@/components/character/CharacterWithGear'
import { GrowthTimeline } from '@/components/character/GrowthTimeline'
import { AttendanceCalendar } from '@/components/dashboard/AttendanceCalendar'
import { PostureStatusBadge } from '@/components/posture/PostureStatusBadge'
import { RecoveryCombo } from '@/components/session/SessionBits'
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  SegmentedControl,
  StatTile,
} from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { SESSION_LENGTHS } from '@/constants/session'
import { BRAND, FRIEND_ROOM, POSTURE_COPY, PRIVACY } from '@/constants/copy'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useToast } from '@/app/providers/ToastProvider'
import { ROUTES } from '@/constants/routes'
import { useUserStore } from '@/features/onboarding/userStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { useGameStore } from '@/features/game/gameStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { MONSTER_THEMES, useActiveModeConfig } from '@/features/modes/modeStore'
import { formatDuration } from '@/features/sessions/sessionMachine'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import {
  formatFocusClock,
  selectSessionStats,
  selectTodayFocus,
} from '@/features/sessions/todayFocus'
import { CampusDashboardCard } from '@/components/campus/CampusDashboardCard'
import { computeStreak } from '@/features/progression/streak'
import { kstDateKey } from '@/lib/time/kst'

/** S-01 랜딩·대시보드 — docs/05_SCREEN_SPEC.md */
export function LandingDashboard() {
  const navigate = useNavigate()
  const { nickname, hasOnboarded, hasCalibration } = useUserStore()
  const modeConfig = useActiveModeConfig()
  const stage = useCharacterStage()
  const { xp, points, attendance } = useProgressionStore()
  const { combo, bestCombo } = useGameStore()
  const snapshot = usePostureStore((s) => s.snapshot)
  const { lengthId, configure, status } = useSessionStore()
  const isMonitoring = status === 'running'
  const { push } = useToast()

  // 세션 요약 저장(finalizeSession) 직후 zustand 구독으로 즉시 갱신됩니다.
  const summaries = useSessionHistoryStore((s) => s.summaries)
  const todayFocus = useMemo(() => selectTodayFocus(summaries), [summaries])
  // 홈·기록·성장이 공유하는 단일 집계 — 값 불일치를 원천 차단합니다.
  const stats = useMemo(() => selectSessionStats(summaries), [summaries])
  const streak = useMemo(() => computeStreak(attendance, kstDateKey()), [attendance])
  const totalFocusMs = stats.totalFocusedMs

  const isFirstVisit = !hasOnboarded

  return (
    <AppShell
      rail={
        <>
          <div>
            <AttendanceCalendar attendance={attendance} />
            <p className="mt-1.5 px-1 text-xs text-ink-soft">
              {`연속 출석 ${streak.current}일 · 최고 ${streak.best}일`}
              {streak.next && ` · 다음 보너스(+${streak.next.points}P)까지 ${streak.next.remaining}일`}
            </p>
          </div>

          {/* 캠퍼스 카드 — 플래그가 꺼져 있으면 렌더되지 않습니다. */}
          <CampusDashboardCard />

          <Card tone="yellow" className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>오늘의 기록</CardTitle>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatTile
                label="집중"
                value={formatFocusClock(todayFocus.focusedMs)}
                tone="surface"
              />
              <StatTile label="콤보" value={String(combo)} unit="회" tone="surface" />
              <StatTile label="포인트" value={String(points)} unit="P" tone="surface" />
            </div>
          </Card>

          <Card tone="blue" className="p-5">
            <p className="text-base leading-snug font-bold text-ink">
              친구와 함께하면
              <br />
              기린 모먼트가 2배로!
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                if (!featureFlags.friendRoom) {
                  push({ title: FRIEND_ROOM.toast, tone: 'info' })
                  return
                }
                navigate(ROUTES.roomNew)
              }}
            >
              {featureFlags.friendRoom ? '친구 방 만들기' : FRIEND_ROOM.ctaLabel}
            </Button>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>현재 모드</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.profiles)}>
                모드 변경
              </Button>
            </div>
            <p className="mt-2 text-sm font-bold text-ink">
              {`${modeConfig.emoji} ${modeConfig.name}`}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {`괴물 · ${MONSTER_THEMES[modeConfig.monsterTheme].name}`}
            </p>
          </Card>

          <Card className="p-4">
            <CardTitle>최근 세션</CardTitle>
            {stats.recentSessions.length === 0 ? (
              <p className="mt-2 text-xs text-ink-soft">아직 세션 기록이 없어요.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {stats.recentSessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.result(s.sessionId ?? s.id))}
                      className="w-full rounded-xl bg-canvas px-3 py-2 text-left text-xs hover:bg-line/40"
                    >
                      <span className="font-bold text-ink">{s.subject || '집중 세션'}</span>
                      <span className="ml-1.5 text-ink-soft">
                        {s.status === 'completed' ? '완료' : '중도 종료'}
                        {' · '}
                        {formatDuration(s.elapsedMs)}
                        {` · 회복 ${s.recoveries}회`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle>빠른 메뉴</CardTitle>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { icon: 'stretch', label: '스트레칭', to: ROUTES.stretch() },
                { icon: 'bag', label: '상점', to: ROUTES.shop },
                { icon: 'chart', label: '기록', to: ROUTES.history },
                { icon: 'settings', label: '설정', to: ROUTES.settings },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface py-3 text-[11px] font-semibold text-ink-soft hover:bg-canvas"
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </>
      }
    >
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          {isFirstVisit ? '오늘의 목표, 편안한 자세로 시작해 볼까요?' : `안녕하세요, ${nickname}님! 👋`}
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          {isFirstVisit ? BRAND.oneLiner : '오늘도 편안한 자세로 목표를 끝내봐요.'}
        </p>
      </header>

      {isFirstVisit ? (
        <Card tone="pink" className="mb-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <CharacterViewport stage={1} size={170} />
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap gap-2">
                {PRIVACY.badges.map((badge) => (
                  <Badge key={badge} tone="green">
                    <Icon name="shield" size={14} />
                    {badge}
                  </Badge>
                ))}
              </div>
              <p className="text-lg font-bold text-ink">
                먼저 이름과 공부 장소를 알려주세요.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                닉네임 → 학습 프로필 → 카메라 안내까지 1분이면 끝나요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="lg" onClick={() => navigate(ROUTES.onboardingName)}>
                  자세 관리 시작하기
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    // 데모 값은 이 버튼처럼 명시적으로 들어올 때만 채웁니다.
                    useDemoStore.getState().enableDemo()
                    configure({ lengthId: 'demo' })
                    navigate(ROUTES.sessionSetup)
                  }}
                >
                  3분 데모 보기
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card tone="pink" className="mb-5">
          {/*
            히어로 3열: 캐릭터 42 · 제목 30 · 세션 선택 28 (넓은 화면 기준 비율).
            제목 영역은 최소 300px 을 보장해 단어 단위 세로 줄바꿈을 막습니다.
          */}
          <div className="grid items-center gap-6 @[700px]:grid-cols-[minmax(190px,42fr)_minmax(300px,30fr)_minmax(230px,28fr)] @[700px]:gap-4">
            <div className="flex justify-center">
              <CharacterWithGear
                stage={stage}
                postureState={isMonitoring ? snapshot.state : 'good'}
                size={210}
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-soft">현재 상태</p>
              <h2 className="mt-1 text-[28px] leading-[1.3] font-bold text-ink @[700px]:text-[32px]">
                {/*
                  세션이 돌지 않을 때는 자세 문구를 그대로 보여주지 않습니다.
                  측정하지 않는 상태에서 "측정하기 어려워요"가 큰 제목으로 뜨면
                  잘못된 인상을 줍니다. 줄바꿈은 keep-all 로 단어 단위 유지.
                */}
                {isMonitoring
                  ? POSTURE_COPY[snapshot.state].message
                  : '오늘도 편안한 자세로 시작해 볼까요?'}
              </h2>
              {isMonitoring ? (
                <div className="mt-2">
                  <PostureStatusBadge
                    state={snapshot.state}
                    quality={snapshot.quality}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">
                  세션을 시작하면 자세를 살펴볼게요.
                </p>
              )}
              <div className="mt-5">
                <RecoveryCombo combo={combo} best={bestCombo} />
              </div>
            </div>

            <div className="w-full">
              <p className="mb-2 text-xs font-semibold text-ink-soft">이번 세션 길이</p>
              {/*
                문서(S-01)는 25분 + 15·50분 보조를 말하지만, 3분 데모도 함께 둡니다.
                데모를 고른 상태에서 대시보드로 돌아왔을 때 아무것도 선택되지 않은
                것처럼 보이지 않게 하려는 목적입니다.
              */}
              <SegmentedControl
                ariaLabel="세션 길이 선택"
                columns={2}
                value={lengthId}
                onChange={(id) => configure({ lengthId: id })}
                options={SESSION_LENGTHS.map((o) => ({
                  id: o.id,
                  label: o.label,
                  sublabel: o.restLabel,
                }))}
              />
              <Button
                size="lg"
                fullWidth
                className="mt-3"
                onClick={() =>
                  navigate(hasCalibration ? ROUTES.sessionSetup : ROUTES.camera)
                }
              >
                <Icon name="play" size={18} />
                지금 집중 시작
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card tone="blue" className="mb-5">
        <GrowthTimeline xp={xp} />
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">최근 세션</h2>
        </div>
        {stats.completedCount === 0 && summaries.length === 0 ? (
          <EmptyState
            title="아직 기록이 없어요"
            description="첫 세션을 마치면 여기에 회복 콤보와 감지 가능 시간이 쌓여요."
            action={
              <Button size="sm" onClick={() => navigate(ROUTES.sessionSetup)}>
                첫 세션 시작하기
              </Button>
            }
          />
        ) : (
          <Card className="p-4">
            <p className="text-sm text-ink-soft">
              {`완료한 세션 ${stats.completedCount}회 · 누적 집중 ${formatDuration(totalFocusMs)}`}
            </p>
          </Card>
        )}
      </section>
    </AppShell>
  )
}
