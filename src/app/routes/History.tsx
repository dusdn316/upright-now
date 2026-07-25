import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { AttendanceCalendar } from '@/components/dashboard/AttendanceCalendar'
import { Card, CardTitle, EmptyState, StatTile } from '@/components/ui'
import { ROUTES } from '@/constants/routes'
import { formatDuration } from '@/features/sessions/sessionMachine'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { useProgressionStore } from '@/features/progression/progressionStore'

/** S-13 기록 — 저장된 세션 목록과 주간 출석 (docs/05) */
export function History() {
  const summaries = useSessionHistoryStore((s) => s.summaries)
  const attendance = useProgressionStore((s) => s.attendance)
  const completed = useProgressionStore((s) => s.completedSessions)

  const totalMs = summaries.reduce((sum, s) => sum + s.elapsedMs, 0)
  const detectableMs = summaries.reduce((sum, s) => sum + s.detectableMs, 0)
  const recoveries = summaries.reduce((sum, s) => sum + s.recoveries, 0)

  return (
    <AppShell
      rail={<AttendanceCalendar attendance={attendance} />}
    >
      <PageHeader
        title="기록"
        description="완료한 세션과 주간 출석을 확인해요. 자세 점수가 아니라 회복·감지 가능 시간을 보여줘요."
        back={ROUTES.home}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="완료 세션" value={String(completed)} unit="회" tone="blue" />
        <StatTile label="총 세션 시간" value={formatDuration(totalMs)} tone="surface" />
        <StatTile label="감지 가능 시간" value={formatDuration(detectableMs)} tone="surface" />
        <StatTile label="회복 성공" value={String(recoveries)} unit="회" tone="yellow" />
      </div>

      <Card>
        <CardTitle>세션 목록</CardTitle>
        {summaries.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="아직 기록이 없어요"
              description="첫 세션을 마치면 여기에 회복 성공과 감지 가능 시간이 쌓여요."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {summaries.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-ink">
                    {s.subject || '집중 세션'}
                    {s.status === 'aborted' && (
                      <span className="ml-2 text-xs font-normal text-ink-soft">
                        중도 종료
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {new Date(s.startedAt).toLocaleString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-ink-soft">
                  <span>세션 {formatDuration(s.elapsedMs)}</span>
                  <span>회복 {s.recoveries}회</span>
                  <span className="font-bold text-ink">+{s.xpEarned} XP</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  )
}
