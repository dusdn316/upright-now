import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardTitle, SegmentedControl, TextField } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { SESSION_LENGTHS } from '@/constants/session'
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
import type { LearningProfileKind } from '@/types'

/** S-06 세션 설정 — 기본값 25분 (docs/05, docs/13 §7) */
export function SessionSetup() {
  const navigate = useNavigate()
  const stage = useCharacterStage()
  const { nickname, profileId, setProfile, hasCalibration } = useUserStore()
  const { subject, goal, lengthId, mode, configure, start } = useSessionStore()
  const resetGame = useGameStore((s) => s.reset)
  const { push } = useToast()

  const startSession = () => {
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
        title="이번 25분에 무엇을 끝내고 싶나요?"
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
                options={SESSION_LENGTHS.map((o) => ({
                  id: o.id,
                  label: o.label,
                  sublabel: o.restLabel,
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>학습 프로필</CardTitle>
            <div className="mt-4">
              <SegmentedControl
                ariaLabel="학습 프로필"
                columns={3}
                value={profileId}
                onChange={(id) => {
                  setProfile(id as LearningProfileKind)
                  configure({ profileId: id as LearningProfileKind })
                }}
                options={LEARNING_PROFILES.map((p) => ({
                  id: p.id,
                  label: p.name,
                  sublabel: p.sound,
                }))}
              />
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
                  { id: 'solo', label: '혼자 집중', sublabel: '개인 마감괴수' },
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
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">연결된 장소 기준</span>
                <Badge tone={hasCalibration ? 'green' : 'muted'}>
                  {hasCalibration ? '등록됨' : '등록 전'}
                </Badge>
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

          <Button size="lg" fullWidth onClick={startSession}>
            <Icon name="play" size={18} />
            {`${SESSION_LENGTHS.find((o) => o.id === lengthId)?.label ?? '25분 집중'} 시작`}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
