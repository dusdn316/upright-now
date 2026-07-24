import { CharacterViewport } from './CharacterViewport'
import { CHARACTER_STAGES } from '@/constants/game'
import { getStageProgress } from '@/features/progression/growth'
import { Progress } from '@/components/ui'
import type { CharacterStage } from '@/types'

/** 6단계 성장 타임라인 — docs/05 S-14, docs/12 §11 */
export function GrowthTimeline({
  xp,
  compact = false,
}: {
  xp: number
  compact?: boolean
}) {
  const progress = getStageProgress(xp)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">성장 진행도</h2>
        <p className="text-sm font-bold text-blue">
          {`Lv.${progress.stage} ${progress.meta.name}`}
        </p>
      </div>

      <ol className="grid grid-cols-6 gap-2" aria-label="캐릭터 6단계 성장">
        {CHARACTER_STAGES.map((meta) => {
          const reached = meta.stage <= progress.stage
          const current = meta.stage === progress.stage
          return (
            <li
              key={meta.stage}
              aria-current={current ? 'step' : undefined}
              className={[
                'flex flex-col items-center gap-1 rounded-2xl border bg-surface px-1 py-2 text-center',
                current
                  ? 'border-blue ring-2 ring-blue/35'
                  : 'border-line',
                reached ? '' : 'opacity-45 grayscale',
              ].join(' ')}
            >
              <span className="text-[11px] font-bold text-ink-soft">
                {meta.stage}
              </span>
              <CharacterViewport
                stage={meta.stage as CharacterStage}
                size={compact ? 52 : 72}
                decorative
              />
              <span className="text-[11px] leading-tight font-semibold text-ink">
                {meta.name}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-col gap-1.5">
        <Progress
          value={progress.ratio}
          tone="blue"
          label="다음 성장 단계까지의 경험치"
        />
        <div className="flex justify-between text-xs text-ink-soft">
          <span>
            {progress.isMax
              ? '마지막 단계에 도달했어요'
              : `다음 단계까지 ${progress.remainingXp} XP`}
          </span>
          <span className="tabular">
            {progress.isMax
              ? `${xp} XP`
              : `${xp} / ${progress.nextMeta?.requiredXp} XP`}
          </span>
        </div>
      </div>
    </div>
  )
}
