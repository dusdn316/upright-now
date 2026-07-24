import { useEffect, useState } from 'react'
import { BOSS_NAME, BOSS_PHASE_LABEL, getBossPhase } from '@/constants/game'
import { Progress } from '@/components/ui'

/** 마감괴수 D-DAY — docs/07_GAME_SYSTEM_SPEC.md §6 */
export function BossHealthBar({
  hp,
  maxHp,
  attackTick = 0,
}: {
  hp: number
  maxHp: number
  attackTick?: number
}) {
  const phase = getBossPhase(hp, maxHp)
  const ratio = Math.max(0, hp / maxHp)
  const [hit, setHit] = useState(false)

  useEffect(() => {
    if (attackTick <= 0) return
    setHit(true)
    const timer = window.setTimeout(() => setHit(false), 360)
    return () => window.clearTimeout(timer)
  }, [attackTick])

  const face = phase === 'defeated' ? '제출 완료' : phase === 'rage' ? '23:59' : 'D-DAY'

  return (
    <div className="flex items-center gap-4">
      <div
        className={[
          'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 text-center',
          phase === 'defeated'
            ? 'border-line bg-canvas text-muted'
            : phase === 'rage'
              ? 'border-coral bg-pink-soft text-[#b8285a]'
              : 'border-line bg-surface text-ink',
          hit ? 'anim-boss-hit' : '',
        ].join(' ')}
        aria-hidden="true"
      >
        <span className="text-[10px] font-bold">📄</span>
        <span className="tabular text-[11px] font-bold">{face}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold text-ink">{BOSS_NAME}</p>
          <p className="tabular text-xs font-semibold text-ink-soft">
            {`${Math.max(0, hp)} / ${maxHp}`}
          </p>
        </div>

        <div className="mt-1.5">
          <Progress
            thick
            value={ratio}
            tone={phase === 'rage' ? 'coral' : 'pink'}
            label={`${BOSS_NAME} 체력`}
          />
        </div>

        <p className="mt-1 text-xs text-ink-soft">{BOSS_PHASE_LABEL[phase]}</p>
      </div>
    </div>
  )
}
