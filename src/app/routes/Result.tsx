import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { GrowthTimeline } from '@/components/character/GrowthTimeline'
import { BossHealthBar } from '@/components/game/BossHealthBar'
import { Badge, Button, Card, CardTitle, StatTile } from '@/components/ui'
import { TARGET_PROGRESS_OPTIONS } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { formatDuration } from '@/features/sessions/sessionMachine'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { selectDamageDealt, useGameStore } from '@/features/game/gameStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'

/**
 * S-12 결과 — docs/05, docs/03 UF-12
 * 평균 자세 점수·CVA·정상/비정상 등급은 표시하지 않습니다. (docs/02 FR-012)
 */
export function Result() {
  const navigate = useNavigate()
  const stage = useCharacterStage()
  const xp = useProgressionStore((s) => s.xp)
  const session = useSessionStore()
  const game = useGameStore()
  const [progress, setProgress] = useState<string | null>(null)

  const completed = session.status === 'completed'

  return (
    <AppShell chrome="focus">
      <PageHeader
        title={
          completed
            ? `오늘의 ${Math.round(session.plannedMs / 60000)}분을 마쳤어요.`
            : '여기까지의 기록을 정리했어요.'
        }
        description={
          completed
            ? '회복 행동이 마감괴수에게 그대로 전달됐어요.'
            : '다음에 이어서 시작해도 괜찮아요.'
        }
        action={<Badge tone={completed ? 'green' : 'muted'}>{completed ? '완료' : '중도 종료'}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card tone="pink">
            <CardTitle>보스 전투 결과</CardTitle>
            <div className="mt-4">
              <BossHealthBar hp={game.boss.hp} maxHp={game.boss.maxHp} />
            </div>
            <div className="mt-4">
              <StatTile
                label="몬스터 피해량"
                value={String(selectDamageDealt(game))}
                tone="surface"
              />
            </div>
          </Card>

          <Card>
            <CardTitle>자세 요약</CardTitle>
            <p className="mt-1 text-xs text-ink-soft">
              세션 시간과 자세를 안정적으로 측정할 수 있었던 시간은 따로 표시해요.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label="학습 세션 시간" value={formatDuration(session.elapsedMs)} tone="canvas" />
              <StatTile label="감지 가능 시간" value={formatDuration(session.detectableMs)} tone="canvas" />
              <StatTile label="자리 비움 시간" value={formatDuration(session.awayMs)} tone="canvas" />
              <StatTile
                label="회복 성공 / 회복 기회"
                value={`${game.recoveries} / ${game.opportunities}`}
                tone="canvas"
              />
              <StatTile
                label="가장 빠른 회복"
                value={
                  game.fastestRecoveryMs === undefined
                    ? '—'
                    : formatDuration(game.fastestRecoveryMs)
                }
                tone="canvas"
              />
              <StatTile label="최고 콤보" value={String(game.bestCombo)} unit="회" tone="canvas" />
            </div>
          </Card>

          <Card tone="blue">
            <GrowthTimeline xp={xp} compact />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card tone="yellow">
            <div className="flex flex-col items-center text-center">
              <CharacterViewport stage={stage} size={140} />
              <CardTitle>이번에 얻은 보상</CardTitle>
              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <StatTile label="경험치" value={`${game.sessionXp}`} unit="XP" tone="surface" />
                <StatTile label="잎사귀" value={`${game.sessionPoints}`} unit="P" tone="surface" />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>이번 목표를 얼마나 진행했나요?</CardTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TARGET_PROGRESS_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={progress === option.id ? 'primary' : 'secondary'}
                  onClick={() => setProgress(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              자세로 집중 여부를 추론하지 않아요. 진행도는 직접 남기는 값이에요.
            </p>
          </Card>

          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => navigate(ROUTES.sessionSetup)}>
              같은 설정으로 다시 시작
            </Button>
            <Button variant="secondary" fullWidth onClick={() => navigate(ROUTES.home)}>
              대시보드로
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
