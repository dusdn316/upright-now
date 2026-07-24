import { formatClock } from '@/features/sessions/sessionMachine'

/** 남은 시간 — 큰 tabular 숫자 (docs/12 §6 Timer) */
export function SessionTimer({
  remaining,
  label = '남은 시간',
}: {
  remaining: number
  label?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <span className="tabular text-5xl leading-none font-bold text-ink">
        {formatClock(remaining)}
      </span>
    </div>
  )
}

/** 회복 콤보 — 자세 점수가 아니라 "회복 행동" 횟수입니다. */
export function RecoveryCombo({
  combo,
  best,
}: {
  combo: number
  best: number
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-ink-soft">회복 콤보</span>
      <span className="tabular text-3xl leading-none font-bold text-ink">
        {combo}
        <span className="ml-1 text-base font-semibold text-ink-soft">회</span>
      </span>
      <span className="mt-1 inline-flex w-fit rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
        {`최고 콤보 ${best}회`}
      </span>
    </div>
  )
}
