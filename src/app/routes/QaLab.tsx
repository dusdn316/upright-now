import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { BossHealthBar } from '@/components/game/BossHealthBar'
import { PostureMessage, PostureStatusBadge } from '@/components/posture/PostureStatusBadge'
import { RecoveryCombo } from '@/components/session/SessionBits'
import { Card, CardTitle, StatTile } from '@/components/ui'
import { QaLabPanel } from '@/features/qa-lab/QaLabPanel'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import { usePostureTicker } from '@/features/posture-engine/usePostureTicker'
import { useGameStore } from '@/features/game/gameStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'

/** S-17 QA Lab — 개발 환경에서만 라우트가 등록됩니다 */
export function QaLab() {
  const stage = useCharacterStage()
  const xp = useProgressionStore((s) => s.xp)
  const points = useProgressionStore((s) => s.points)
  const snapshot = usePostureStore((s) => s.snapshot)
  const visualIntent = useCharacterVisualStore((s) => s.intent)
  const game = useGameStore()

  // 실제 자세 머신을 굴려 QA 상태 주입이 회복 수명주기를 그대로 타게 합니다.
  usePostureTicker(true)

  return (
    <AppShell>
      <PageHeader
        title="QA Lab"
        description="카메라 없이 자세 상태를 주입해 전체 흐름을 검증합니다. 운영 빌드에서는 VITE_ENABLE_QA_LAB=false 로 숨깁니다."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card tone="pink">
          <CardTitle>현재 반응 미리보기</CardTitle>
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
            <CharacterViewport
              stage={stage}
              postureState={snapshot.state}
              visualState={visualIntent ?? 'idle'}
              attackTick={game.attackTick}
              size={180}
            />
            <div className="min-w-0 flex-1">
              <PostureStatusBadge state={snapshot.state} quality={snapshot.quality} />
              <div className="mt-2">
                <PostureMessage state={snapshot.state} />
              </div>
              <div className="mt-4">
                <RecoveryCombo combo={game.combo} best={game.bestCombo} />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-surface/80 p-4">
            <BossHealthBar
              hp={game.boss.hp}
              maxHp={game.boss.maxHp}
              attackTick={game.attackTick}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="누적 XP" value={String(xp)} tone="surface" />
            <StatTile label="잎사귀" value={String(points)} unit="P" tone="surface" />
            <StatTile label="회복 성공" value={String(game.recoveries)} unit="회" tone="surface" />
            <StatTile label="성장 단계" value={`Lv.${stage}`} tone="surface" />
          </div>
        </Card>

        <QaLabPanel />
      </div>
    </AppShell>
  )
}
