import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardTitle, SegmentedControl, TextField } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { SESSION_LENGTHS, sessionSetupTitle } from '@/constants/session'
import { FRIEND_ROOM } from '@/constants/copy'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useToast } from '@/app/providers/ToastProvider'
import { openPip } from '@/features/pip/pipController'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { ROUTES } from '@/constants/routes'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { useCharacterStage } from '@/features/progression/progressionStore'
import { useGameStore } from '@/features/game/gameStore'
import { useModeStore, useActiveModeConfig, MONSTER_THEMES } from '@/features/modes/modeStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { useCalibrationStore, hasValidActiveProfile } from '@/features/calibration/calibrationStore'
import { useState } from 'react'

/** S-06 세션 설정 — 기본값 25분 (docs/05, docs/13 §7) */
export function SessionSetup() {
  const navigate = useNavigate()
  const stage = useCharacterStage()
  const { nickname, hasCalibration } = useUserStore()
  const modeConfig = useActiveModeConfig()
  const customModes = useModeStore((s) => s.customModes)
  const setActiveMode = useModeStore((s) => s.setActiveMode)
  const calProfiles = useCalibrationStore((s) => s.profiles)
  const activeProfileId = useCalibrationStore((s) => s.activeProfileId)
  const selectProfile = useCalibrationStore((s) => s.selectProfile)
  const [customFocus, setCustomFocus] = useState(25)
  const [customRest, setCustomRest] = useState(5)
  const { subject, goal, lengthId, mode, configure, start } = useSessionStore()
  const resetGame = useGameStore((s) => s.reset)
  const isDemo = useDemoStore((s) => s.isDemo)
  const { push } = useToast()

  // 비데모 일반 세션은 "유효한 활성 기준"이 있어야 시작할 수 있습니다. (3분 데모 예외)
  // 프로필 개수가 아니라 activeProfileId 가 가리키는 실제 프로필의 유효성을 봅니다.
  const calibrationExempt = !featureFlags.camera || isDemo || lengthId === 'demo'
  const validActive = hasValidActiveProfile({
    profiles: calProfiles,
    activeProfileId,
  })
  const needRegister = !calibrationExempt && calProfiles.length === 0
  const needSelect = !calibrationExempt && calProfiles.length > 0 && !validActive
  const calibrationRequired = needRegister || needSelect

  const startSession = () => {
    if (calibrationRequired) return
    // 데모 모드 중에는 일반 세션을 시작하지 않습니다. (기록 오염 방지)
    if (isDemo && lengthId !== 'demo') {
      push({
        title: '데모 중에는 3분 데모 세션만 시작할 수 있어요. 먼저 데모를 종료해 주세요.',
        tone: 'info',
      })
      return
    }
    resetGame()
    const id = `s-${Date.now()}`
    start(id)
    // PiP 는 사용자 제스처가 필요 — 같은 click handler 안에서 요청합니다.
    if (useUserStore.getState().pipAutoOpen) {
      void openPip().then((result) => {
        if (result !== 'opened') {
          push({
            title: '작은 별도 창을 열지 못해 화면 안 미니 위젯으로 표시해요.',
            tone: 'info',
          })
        }
      })
    }
    navigate(ROUTES.session(id))
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title={sessionSetupTitle(lengthId, customFocus)}
        description="목표는 나중에 결과 화면에서 직접 진행도를 남길 수 있어요."
        back={ROUTES.home}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>무엇을 하나요?</CardTitle>
            <div className="mt-4 flex flex-col gap-4">
              <TextField
                label="과목 또는 과제명"
                id="subject"
                placeholder="예: 자료구조"
                value={subject}
                onChange={(e) => configure({ subject: e.target.value })}
              />
              <TextField
                label="오늘 목표"
                id="goal"
                placeholder="예: 자료구조 3장 문제 풀기"
                value={goal}
                onChange={(e) => configure({ goal: e.target.value })}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>세션 길이</CardTitle>
            <div className="mt-4">
              <SegmentedControl
                ariaLabel="세션 길이"
                columns={2}
                value={lengthId}
                onChange={(id) => configure({ lengthId: id })}
                options={[
                  ...SESSION_LENGTHS.map((o) => ({ id: o.id, label: o.label, sublabel: o.restLabel })),
                  { id: 'custom', label: '직접 설정', sublabel: '5~120분' },
                ]}
              />
              {lengthId === 'custom' && (
                <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-soft">집중 (5~120분, 5분 단위)</span>
                    <input type="number" min={5} max={120} step={5} value={customFocus}
                      onChange={(e) => { const v = Number(e.target.value); setCustomFocus(v); configure({ lengthId: 'custom', customFocusMin: v, customRestMin: customRest }) }}
                      className="h-10 w-28 rounded-xl border border-line bg-surface px-3" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-soft">회복 휴식 (0~30분)</span>
                    <input type="number" min={0} max={30} step={5} value={customRest}
                      onChange={(e) => { const v = Number(e.target.value); setCustomRest(v); configure({ lengthId: 'custom', customFocusMin: customFocus, customRestMin: v }) }}
                      className="h-10 w-28 rounded-xl border border-line bg-surface px-3" />
                  </label>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>학습 프로필</CardTitle>
            <div className="mt-4">
              <SegmentedControl
                ariaLabel="학습 모드"
                columns={3}
                value={modeConfig.id}
                onChange={(id) => setActiveMode(id)}
                options={[
                  ...LEARNING_PROFILES.map((p) => ({ id: p.id, label: p.name, sublabel: p.sound })),
                  ...customModes.map((m) => ({ id: m.id, label: m.emoji + ' ' + m.name, sublabel: '내 모드' })),
                ]}
              />
              <p className="mt-2 text-xs text-ink-soft">
                모드 관리는{' '}
                <button type="button" className="font-bold underline" onClick={() => navigate(ROUTES.profiles)}>
                  모드 화면
                </button>
                에서 할 수 있어요. 모드를 바꿔도 XP·기록은 유지돼요.
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle>혼자 · 친구</CardTitle>
            <div className="mt-4">
              <SegmentedControl
                ariaLabel="세션 모드"
                columns={2}
                value={mode}
                onChange={(id) => {
                  if (id === 'room' && !featureFlags.friendRoom) {
                    push({ title: FRIEND_ROOM.toast, tone: 'info' })
                    return
                  }
                  configure({ mode: id as 'solo' | 'room' })
                }}
                options={[
                  { id: 'solo', label: '혼자 집중', sublabel: `개인 ${MONSTER_THEMES[modeConfig.monsterTheme].name}` },
                  {
                    id: 'room',
                    label: '친구와 함께',
                    badge: featureFlags.friendRoom ? undefined : FRIEND_ROOM.badge,
                    sublabel: '공동 보스와 기린 싱크',
                  },
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card tone="pink">
            <div className="flex flex-col items-center text-center">
              <CharacterViewport stage={stage} size={150} />
              <p className="mt-2 text-sm font-bold text-ink">{nickname}</p>
              <p className="text-xs text-ink-soft">과잠·백팩 미장착</p>
            </div>
          </Card>

          <Card>
            <CardTitle>준비 상태</CardTitle>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li className="flex flex-col gap-1">
                <span className="text-ink-soft">사용할 자세 기준</span>
                {calProfiles.length > 0 ? (
                  <select
                    aria-label="자세 기준 선택"
                    value={validActive ? (activeProfileId ?? '') : ''}
                    onChange={(e) => e.target.value && selectProfile(e.target.value)}
                    className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                  >
                    {!validActive && (
                      <option value="" disabled>
                        사용할 자세 기준을 선택해 주세요
                      </option>
                    )}
                    {calProfiles.map((cp) => (
                      <option key={cp.id} value={cp.id}>{cp.name}</option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={hasCalibration ? 'green' : 'muted'}>등록 전</Badge>
                )}
                <button type="button" className="self-start text-xs font-bold text-blue underline" onClick={() => navigate(ROUTES.calibration)}>
                  새 기준 등록
                </button>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">소리</span>
                <Badge tone="muted">무음</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">카메라</span>
                <Badge tone={featureFlags.camera ? 'green' : 'muted'}>
                  {featureFlags.camera ? '사용 가능' : '카메라 없이 진행'}
                </Badge>
              </li>
            </ul>
          </Card>

          {needSelect ? (
            <Button size="lg" fullWidth disabled>
              사용할 자세 기준을 선택해 주세요
            </Button>
          ) : needRegister ? (
            <Button
              size="lg"
              fullWidth
              onClick={() => navigate(`${ROUTES.calibration}?return=${ROUTES.sessionSetup}`)}
            >
              자세 기준 등록
            </Button>
          ) : (
            <Button size="lg" fullWidth onClick={startSession}>
              <Icon name="play" size={18} />
              {lengthId === 'custom' ? `${customFocus}분 집중 시작` : `${SESSION_LENGTHS.find((o) => o.id === lengthId)?.label ?? '25분 집중'} 시작`}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}
