import type { SessionSummary } from '@/types'

interface SessionShape {
  subject: string
  goal: string
  plannedMs: number
  elapsedMs: number
  detectableMs: number
  awayMs: number
  unstableMs: number
}

interface GameShape {
  opportunities: number
  recoveries: number
  fastestRecoveryMs?: number
  bestCombo: number
  sessionXp: number
  sessionPoints: number
  boss: { hp: number; maxHp: number }
}

/** 세션·게임 스토어에서 저장용 요약을 만듭니다. (프레임 로그 없음, 집계값만) */
export function buildSessionSummary(
  session: SessionShape,
  game: GameShape,
  status: 'completed' | 'aborted',
): SessionSummary {
  const now = Date.now()
  return {
    id: `sum-${now}-${Math.round(Math.random() * 1000)}`,
    startedAt: now - session.elapsedMs,
    endedAt: now,
    status,
    subject: session.subject || undefined,
    goal: session.goal || undefined,
    plannedDurationMs: session.plannedMs,
    elapsedMs: session.elapsedMs,
    detectableMs: session.detectableMs,
    awayMs: session.awayMs,
    unstableMs: session.unstableMs,
    recoveryOpportunities: game.opportunities,
    recoveries: game.recoveries,
    fastestRecoveryMs: game.fastestRecoveryMs,
    bestCombo: game.bestCombo,
    damageDealt: game.boss.maxHp - game.boss.hp,
    xpEarned: game.sessionXp,
    pointsEarned: game.sessionPoints,
  }
}
