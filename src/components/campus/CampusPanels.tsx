import { useMemo } from 'react'
import { Badge, Card, CardTitle, EmptyState, Progress, StatTile } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CAMPUS_COPY, CAMPUS_ZONE_META } from '@/constants/campus'
import { CONTRIBUTION_LIMITS, CONTRIBUTION_POINTS } from '@/features/campus/contribution'
import { formatRemaining, formatSeasonRange, seasonRemainingMs } from '@/features/campus/season'
import { captureProgress, tileStatus } from '@/features/campus/territory'
import { useCampusTheme } from '@/features/campus/campusThemeStore'
import type {
  CampusSchoolStanding,
  CampusSeason,
  CampusSnapshot,
  CampusTile,
  CampusTileEvent,
} from '@/features/campus/types'
import { schoolShortName, useSchoolColor } from './TerritoryMap'
import { CampusSchoolBadge } from './CampusBits'

/** 시즌 요약 — 남은 시간을 분 단위까지만 보여 줍니다. */
export function CampusSeasonBar({ season, now }: { season: CampusSeason; now: number }) {
  const remaining = seasonRemainingMs(season, now)
  const total = Math.max(1, season.endsAt - season.startsAt)
  const elapsed = 1 - remaining / total

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-ink">{`${season.name} · ${formatSeasonRange(season)}`}</p>
        <p className="text-xs text-ink-soft">
          남은 시간 <span className="tabular font-bold text-ink">{formatRemaining(remaining)}</span>
        </p>
      </div>
      <Progress value={elapsed} tone="blue" label={`${season.name} 진행도`} />
      <p className="text-[11px] text-ink-soft">
        시즌이 끝나면 최종 지도를 기록에 보관하고 새 시즌 지도를 초기화해요.
      </p>
    </div>
  )
}

/** 내 학교 · 이번 시즌 · 점령 타일 수 · 내 기여도 */
export function CampusStatsRow({
  snapshot,
  myTiles,
  now,
}: {
  snapshot: CampusSnapshot
  myTiles: number
  now: number
}) {
  const theme = useCampusTheme()
  return (
    <div className="grid grid-cols-2 gap-2 @[720px]:grid-cols-4">
      <div className="rounded-2xl border border-line bg-surface px-4 py-3">
        <p className="text-xs font-semibold text-ink-soft">내 학교</p>
        <div className="mt-1.5">
          {theme ? (
            <CampusSchoolBadge theme={theme} />
          ) : (
            <Badge tone="muted">선택 전</Badge>
          )}
        </div>
      </div>
      <StatTile label="이번 시즌" value={snapshot.season.name} tone="canvas" />
      <StatTile
        label="점령 타일 수"
        value={String(myTiles)}
        unit="칸"
        tone="canvas"
      />
      <StatTile
        label="내 기여도"
        value={String(snapshot.myContribution)}
        unit="점"
        tone="canvas"
      />
      <span className="sr-only">{`시즌 남은 시간 ${formatRemaining(seasonRemainingMs(snapshot.season, now))}`}</span>
    </div>
  )
}

const TILE_EVENT_LABEL: Record<CampusTileEvent['kind'], string> = {
  captured: '점령',
  contested: '경합 시작',
  reinforced: '방어 보강',
}

/** 최근 점령 로그 / 최근 영토 변화 */
export function CampusCaptureLog({
  events,
  tiles,
  limit = 8,
}: {
  events: CampusTileEvent[]
  tiles: CampusTile[]
  limit?: number
}) {
  const colorOf = useSchoolColor()
  const zoneById = useMemo(() => {
    const map = new Map<string, CampusTile>()
    for (const tile of tiles) map.set(tile.id, tile)
    return map
  }, [tiles])

  if (events.length === 0) {
    return (
      <EmptyState
        title="아직 영토 변화가 없어요"
        description="세션을 정상 완료하거나 자세를 회복하면 기여도가 쌓이고 지도가 움직여요."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {events.slice(0, limit).map((event) => {
        const tile = zoneById.get(event.tileId)
        const zoneLabel = tile ? CAMPUS_ZONE_META[tile.zone].label : '캠퍼스'
        const color = colorOf(event.toSchoolId)
        return (
          <li
            key={event.id}
            data-testid="campus-log-row"
            className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2 text-xs"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-[3px] border border-line"
              style={{ backgroundColor: color ?? 'transparent' }}
            />
            <span className="min-w-0 flex-1 truncate text-ink">
              {`${zoneLabel} · ${TILE_EVENT_LABEL[event.kind]} · ${schoolShortName(event.toSchoolId)}`}
              {event.fromSchoolId && event.kind === 'captured'
                ? ` (이전 ${schoolShortName(event.fromSchoolId)})`
                : ''}
            </span>
            <span className="tabular shrink-0 text-ink-soft">
              {new Date(event.at).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 학교별 기여도 — 총 기여도와 규모 보정 점수를 함께 보여 줍니다.
 * 실제 공식 순위가 아니라는 사실을 같은 카드 안에 적습니다.
 */
export function CampusStandingsTable({
  standings,
  mySchoolId,
  limit = 6,
}: {
  standings: CampusSchoolStanding[]
  mySchoolId: string | null
  limit?: number
}) {
  const colorOf = useSchoolColor()
  const top = standings.slice(0, limit)
  const maxNormalized = Math.max(1, ...top.map((s) => s.normalizedScore))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* 표는 자기 영역 안에서만 가로 스크롤합니다. 페이지 본문은 넘치지 않습니다. */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <caption className="sr-only">
            학교별 총 기여도와 규모 보정 점수 (공식 순위가 아닙니다)
          </caption>
          <thead>
            <tr className="text-ink-soft">
              <th scope="col" className="py-1.5 pr-2 font-semibold">학교</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">총 기여도</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">참여자</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-semibold">보정 점수</th>
              <th scope="col" className="py-1.5 text-right font-semibold">타일</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row) => (
              <tr
                key={row.schoolId}
                data-testid="campus-standing-row"
                className={row.schoolId === mySchoolId ? 'font-bold text-ink' : 'text-ink'}
              >
                <td className="py-1.5 pr-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 rounded-[3px]"
                      style={{ backgroundColor: colorOf(row.schoolId) ?? '#EFE9DC' }}
                    />
                    {schoolShortName(row.schoolId)}
                    {row.schoolId === mySchoolId && <span className="sr-only">(내 학교)</span>}
                  </span>
                </td>
                <td className="tabular py-1.5 pr-2 text-right">{row.totalContribution}</td>
                <td className="tabular py-1.5 pr-2 text-right">{row.activeContributors}</td>
                <td className="tabular py-1.5 pr-2 text-right">
                  {Math.round(row.normalizedScore)}
                  <span className="ml-1 inline-block h-1.5 w-8 rounded-full bg-line align-middle">
                    <span
                      className="block h-1.5 rounded-full bg-blue"
                      style={{ width: `${Math.round((row.normalizedScore / maxNormalized) * 100)}%` }}
                    />
                  </span>
                </td>
                <td className="tabular py-1.5 text-right">{row.tiles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-soft">{CAMPUS_COPY.scoreNotice}</p>
    </div>
  )
}

/** 기여 이벤트 표 — 자세 점수를 쓰지 않는다는 사실을 함께 적습니다. */
export function CampusContributionRules() {
  return (
    <Card className="p-4">
      <CardTitle>기여도가 쌓이는 순간</CardTitle>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink">
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Icon name="check" size={16} />세션 정상 완료
          </span>
          <span className="tabular font-bold">{`+${CONTRIBUTION_POINTS.session_completed}`}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Icon name="check" size={16} />자세 회복 성공
          </span>
          <span className="tabular font-bold">{`+${CONTRIBUTION_POINTS.posture_recovered}`}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Icon name="friends" size={16} />친구 세션 완주
          </span>
          <span className="tabular font-bold">{`+${CONTRIBUTION_POINTS.friend_session_completed}`}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Icon name="stretch" size={16} />스트레칭 완주
          </span>
          <span className="tabular font-bold">{`+${CONTRIBUTION_POINTS.stretch_completed}`}</span>
        </li>
      </ul>
      <div className="mt-3 flex flex-col gap-1 text-[11px] text-ink-soft">
        <p>· {CAMPUS_COPY.contributionNotice}</p>
        <p>· 중도 종료·데모·QA 세션은 기여도가 없어요.</p>
        <p>
          {`· 하루 최대 ${CONTRIBUTION_LIMITS.dailyCap}점 · 회복 기여는 세션당 ${CONTRIBUTION_LIMITS.recoveryPerSession}회까지 반영돼요.`}
        </p>
        <p>· {CAMPUS_COPY.privacy}</p>
      </div>
    </Card>
  )
}

/** 선택한 타일 상세 */
export function CampusTileDetail({ tile }: { tile: CampusTile | null }) {
  const colorOf = useSchoolColor()
  if (!tile) {
    return (
      <p className="text-sm text-ink-soft">
        지도에서 타일을 고르면 이 자리에 상세 정보가 나와요.
      </p>
    )
  }

  const zone = CAMPUS_ZONE_META[tile.zone]
  const status = tileStatus(tile)
  const progress = captureProgress(tile)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name={zone.icon} size={16} />
          {`${zone.label} · ${tile.y + 1}행 ${tile.x + 1}열`}
        </p>
        <Badge tone={status === 'contested' ? 'coral' : status === 'held' ? 'blue' : 'muted'}>
          {status === 'contested' ? '경합 중' : status === 'held' ? '점령됨' : '중립'}
        </Badge>
      </div>
      <p className="text-xs text-ink-soft">{zone.description}</p>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-ink-soft">현재 점령 학교</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-bold text-ink">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-[3px] border border-line"
              style={{ backgroundColor: colorOf(tile.ownerSchoolId) ?? 'transparent' }}
            />
            {schoolShortName(tile.ownerSchoolId)}
          </dd>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-ink-soft">도전 학교</dt>
          <dd className="mt-0.5 font-bold text-ink">
            {tile.challengerSchoolId ? schoolShortName(tile.challengerSchoolId) : '없음'}
          </dd>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-ink-soft">방어 점수</dt>
          <dd className="tabular mt-0.5 font-bold text-ink">{tile.defenseScore}</dd>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-ink-soft">공격 점수</dt>
          <dd className="tabular mt-0.5 font-bold text-ink">{tile.challengeScore}</dd>
        </div>
      </dl>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
          <span>점령 진행도</span>
          <span className="tabular font-bold text-ink">{`${Math.round(progress * 100)}%`}</span>
        </div>
        <Progress
          value={progress}
          tone={status === 'contested' ? 'coral' : 'blue'}
          label="점령 진행도"
        />
      </div>

      <p className="text-[11px] text-ink-soft">
        {`마지막 변화 ${new Date(tile.updatedAt).toLocaleString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`}
      </p>
    </div>
  )
}
