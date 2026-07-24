import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button, Card, Progress } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { STRETCH_SAFETY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { recommendStretch } from '@/features/stretch/recommend'
import { useUserStore } from '@/features/onboarding/userStore'
import { useGameStore } from '@/features/game/gameStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useToast } from '@/app/providers/ToastProvider'
import { REWARD } from '@/constants/game'
import type { StretchRoutine } from '@/types'

/** S-11 스트레칭 — 모드별 가중 랜덤, 건너뛰기 불이익 없음 (docs/09) */
export function Stretch() {
  const navigate = useNavigate()
  const profileId = useUserStore((s) => s.profileId)
  const { push } = useToast()
  const prevIdRef = useRef<string | undefined>(undefined)

  const [routine, setRoutine] = useState<StretchRoutine>(() => {
    const first = recommendStretch(profileId)
    prevIdRef.current = first.id
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
    setRoutine(next)
    setRemaining(next.durationSec)
    setPaused(false)
    setDone(false)
  }

  const finish = () => {
    if (done) return
    setDone(true)
    // 완료 → 방어막 회복 · XP · 포인트
    useGameStore.getState().stretchCompleted()
    useProgressionStore.getState().addXp(REWARD.stretch.xp)
    useProgressionStore.getState().addPoints(REWARD.stretch.points)
    push({ title: '방어막을 회복했어요! 잠깐의 리셋, 잘했어요.', tone: 'success' })
  }

  const progress = 1 - remaining / routine.durationSec

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="2분 리셋"
        description="오래 앉아 있던 흐름을 짧게 리셋해요. 건너뛰어도 불이익이 없어요."
      />

      <div className="mx-auto max-w-xl">
        <Card tone="green">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-surface">
              <Icon name="stretch" size={64} className="text-green" />
            </div>
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
                <Button size="sm" variant="secondary" onClick={pickAnother}>
                  다른 동작
                </Button>
                <Button size="sm" onClick={finish}>
                  완료
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(ROUTES.result())}
            >
              {done ? '결과 보기' : '건너뛰기'}
            </Button>
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-ink-soft">{STRETCH_SAFETY}</p>
      </div>
    </AppShell>
  )
}
