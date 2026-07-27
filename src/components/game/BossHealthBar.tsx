import { useEffect, useState } from 'react'
import { BOSS_NAME, BOSS_PHASE_LABEL, getBossPhase } from '@/constants/game'
import { Progress } from '@/components/ui'
import { MonsterViewport } from './MonsterViewport'
import type { MonsterThemeId } from '@/features/modes/modeStore'

/** 공동/개인 마감 괴물 — 모드별 이름(북몽이·늘몽이·꼬몽이) 표시 지원 */
export function BossHealthBar({
  hp,
  maxHp,
  attackTick = 0,
  name = BOSS_NAME,
  damage,
  monsterTheme,
  monsterPhase,
}: {
  hp: number
  maxHp: number
  attackTick?: number
  /** 모드별 괴물 이름 */
  name?: string
  /** 피격 시 표시할 피해량 숫자 */
  damage?: number
  /** 승인 괴물 이미지 표시용 테마·단계 (없으면 기존 문자 아이콘) */
  monsterTheme?: MonsterThemeId
  monsterPhase?: number
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
          // 승인 괴물 이미지가 HP UI 에 비해 작아 보이지 않도록 슬롯 96~108px
          'relative flex h-[100px] w-[100px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 text-center',
          phase === 'defeated'
            ? 'border-line bg-canvas text-muted'
            : phase === 'rage'
              ? 'border-coral bg-pink-soft text-[#b8285a]'
              : 'border-line bg-surface text-ink',
          hit ? 'anim-boss-hit' : '',
        ].join(' ')}
        aria-hidden="true"
      >
        {monsterTheme ? (
          <MonsterViewport
            theme={monsterTheme}
            phase={monsterPhase ?? 1}
            visual={phase === 'defeated' ? 'defeated' : 'idle'}
            hitTick={hit ? attackTick : 0}
            size={92}
          />
        ) : (
          <>
            <span className="text-[10px] font-bold">📄</span>
            <span className="tabular text-[11px] font-bold">{face}</span>
          </>
        )}
        {hit && damage !== undefined && (
          <span className="boss-damage-number tabular">{`-${damage}`}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold text-ink">{name}</p>
          <p className="tabular text-xs font-semibold text-ink-soft">
            {`${Math.max(0, hp)} / ${maxHp}`}
          </p>
        </div>

        <div className="mt-1.5">
          <Progress
            thick
            value={ratio}
            tone={phase === 'rage' ? 'coral' : 'pink'}
            label={`${name} 체력`}
          />
        </div>

        <p className="mt-1 text-xs text-ink-soft">{BOSS_PHASE_LABEL[phase]}</p>
      </div>
    </div>
  )
}
