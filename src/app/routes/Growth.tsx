import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { GrowthTimeline } from '@/components/character/GrowthTimeline'
import { CharacterWithGear } from '@/components/character/CharacterWithGear'
import { Badge, Card, CardTitle, StatTile } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { getStageProgress } from '@/features/progression/growth'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'

/** S-14 성장 — 현재 캐릭터·다음 단계·최근 획득 XP */
export function Growth() {
  const xp = useProgressionStore((s) => s.xp)
  const recentXp = useProgressionStore((s) => s.recentXp)
  const stage = useCharacterStage()
  const progress = getStageProgress(xp)

  return (
    <AppShell>
      <PageHeader
        title="성장"
        description="바른 자세로 회복할 때마다 쌓인 경험치로 6단계 캐릭터가 성장해요."
      />

      <Card tone="blue" className="mb-4">
        <GrowthTimeline xp={xp} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 현재 캐릭터 큰 미리보기 */}
        <Card tone="green">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <CharacterWithGear stage={stage} size={260} />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold text-ink-soft">현재 캐릭터</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">
                {`Lv.${progress.meta.stage} ${progress.meta.name}`}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{progress.meta.tagline}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <StatTile label="현재 XP" value={String(xp)} tone="surface" />
                <StatTile
                  label="다음 단계까지"
                  value={progress.isMax ? '완성' : `${progress.remainingXp} XP`}
                  tone="surface"
                />
              </div>
            </div>
          </div>

          {!progress.isMax && progress.nextMeta && (
            <div className="mt-4 rounded-2xl bg-surface/80 p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Icon name="growth" size={16} />
                {`다음 단계: Lv.${progress.nextMeta.stage} ${progress.nextMeta.name}`}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {`달라지는 모습 — ${progress.nextMeta.visualDiff}`}
              </p>
            </div>
          )}
        </Card>

        {/* 최근 획득 XP */}
        <Card>
          <CardTitle>최근 획득 XP</CardTitle>
          {recentXp.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              아직 획득 기록이 없어요. 세션을 완료하거나 자세를 회복하면 여기에
              쌓여요.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {recentXp.map((record) => (
                <li
                  key={record.at}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm"
                >
                  <span className="text-ink">{record.label}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone="blue">{`+${record.xp} XP`}</Badge>
                    <span className="text-xs text-ink-soft">
                      {new Date(record.at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
