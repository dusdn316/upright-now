import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, CardTitle, StatTile } from '@/components/ui'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCampusScreen } from '@/features/campus/useCampusScreen'
import { formatRemaining, seasonRemainingMs } from '@/features/campus/season'
import { useCampusTheme } from '@/features/campus/campusThemeStore'
import { CampusSchoolBadge } from './CampusBits'

/**
 * 대시보드 캠퍼스 카드.
 *
 * 플래그가 꺼져 있으면 아무것도 렌더하지 않습니다 → 기존 대시보드와 동일합니다.
 * 자세·XP·보상 수치는 여기서 다루지 않습니다.
 */
export function CampusDashboardCard() {
  const navigate = useNavigate()
  const theme = useCampusTheme()

  if (!featureFlags.campusTerritory) return null
  return <CampusDashboardCardBody theme={theme} onNavigate={navigate} />
}

function CampusDashboardCardBody({
  theme,
  onNavigate,
}: {
  theme: ReturnType<typeof useCampusTheme>
  onNavigate: (to: string) => void
}) {
  const { snapshot, myTiles, schoolId } = useCampusScreen()
  const remaining = seasonRemainingMs(snapshot.season, Date.now())

  return (
    <div data-testid="campus-dashboard-card">
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>캠퍼스</CardTitle>
        {theme ? <CampusSchoolBadge theme={theme} size="sm" /> : <Badge tone="muted">학교 선택 전</Badge>}
      </div>

      {schoolId ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label="점령" value={String(myTiles)} unit="칸" tone="canvas" />
            <StatTile
              label="내 기여"
              value={String(snapshot.myContribution)}
              unit="점"
              tone="canvas"
            />
            <StatTile label="시즌" value={formatRemaining(remaining)} tone="canvas" />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => onNavigate(ROUTES.campus)}
          >
            영토전 보기
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-ink-soft">
            학교를 고르면 캠퍼스 테마와 가상 영토전을 볼 수 있어요. 비공식 프로토타입이에요.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => onNavigate(ROUTES.settings)}
          >
            학교 고르기
          </Button>
        </>
      )}
      <p className="mt-2 text-[11px] text-ink-soft">
        공식 대항전이 아니고, 학교를 대표하지도 않아요.
      </p>
    </Card>
    </div>
  )
}
