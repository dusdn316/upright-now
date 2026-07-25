import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardTitle, EmptyState } from '@/components/ui'
import { CAMPUS_COPY } from '@/constants/campus'
import { ROUTES } from '@/constants/routes'
import { formatSeasonRange } from '@/features/campus/season'
import { rankStandings } from '@/features/campus/contribution'
import { useCampusScreen } from '@/features/campus/useCampusScreen'
import { CampusUnofficialNotice } from '@/components/campus/CampusBits'
import { CampusCaptureLog, CampusStandingsTable } from '@/components/campus/CampusPanels'
import { TerritoryLegend, TerritoryMap } from '@/components/campus/TerritoryMap'

/**
 * S-C3 캠퍼스 기록 — 최근 영토 변화 전체와 종료된 시즌의 최종 지도.
 * 시즌이 끝나면 지도를 여기 보관하고, 새 시즌 지도는 초기화됩니다.
 */
export function CampusHistory() {
  const navigate = useNavigate()
  const { snapshot, schoolId } = useCampusScreen()

  return (
    <AppShell>
      <PageHeader
        title="캠퍼스 기록"
        description="영토 변화와 지난 시즌의 최종 지도를 모아 둔 화면이에요."
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.campus)}>
            캠퍼스로
          </Button>
        }
      />

      <CampusUnofficialNotice className="mb-4" />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{`${snapshot.season.name} 영토 변화`}</CardTitle>
          <Badge tone="muted">{formatSeasonRange(snapshot.season)}</Badge>
        </div>
        <div className="mt-3">
          <CampusCaptureLog
            events={snapshot.tileEvents}
            tiles={snapshot.tiles}
            limit={40}
          />
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">지난 시즌 최종 지도</h2>
        {snapshot.archived.length === 0 ? (
          <EmptyState
            title="아직 보관된 시즌이 없어요"
            description="첫 시즌이 끝나면 최종 지도와 학교별 기여도를 여기에 보관해요."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {snapshot.archived.map((entry) => (
              <Card key={entry.season.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{`${entry.season.name} 최종 지도`}</CardTitle>
                  <Badge tone="muted">{formatSeasonRange(entry.season)}</Badge>
                </div>
                {entry.tiles.length > 0 ? (
                  <>
                    <div className="mt-4">
                      <TerritoryMap tiles={entry.tiles} />
                    </div>
                    <div className="mt-3">
                      <TerritoryLegend tiles={entry.tiles} />
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-ink-soft">
                    이 시즌의 타일 기록은 보관되지 않았어요.
                  </p>
                )}
                {entry.standings.length > 0 && (
                  <div className="mt-4">
                    <CampusStandingsTable
                      standings={rankStandings(entry.standings)}
                      mySchoolId={schoolId}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-ink-soft">{CAMPUS_COPY.mockNotice}</p>
    </AppShell>
  )
}
