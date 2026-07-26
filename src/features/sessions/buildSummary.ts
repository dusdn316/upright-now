import type { SessionSummary } from '@/types'

interface SessionShape {
  sessionId: string
  /** start() 시각 (epoch ms). 0 이면 구버전 호환으로 역산합니다. */
  startedAt: number
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
  extra: Pick<SessionSummary, 'isTest' | 'completionReason'> = {},
): SessionSummary {
  const now = Date.now()
  return {
    id: `sum-${now}-${Math.round(Math.random() * 1000)}`,
    sessionId: session.sessionId,
    // 실제 시작 시각을 우선합니다 — 역산(now - elapsed)은 스트레칭 등으로
    // 세션이 멈춰 있던 시간을 무시해 날짜 집계가 틀어질 수 있습니다.
    startedAt: session.startedAt > 0 ? session.startedAt : now - session.elapsedMs,
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
    ...extra,
  }
}
