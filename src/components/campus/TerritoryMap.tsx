import { useMemo } from 'react'
import { useCampusStore } from '@/features/campus/campusStore'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import { summarizeDistricts, SEOUL_DISTRICTS } from '@/features/campus/seoulDistrictMap'
import { useSchoolIdentity, resolveSchoolIdentityNow } from '@/features/campus/schoolDirectory'
import type { CampusTile } from '@/features/campus/types'

export function useSchoolColor(): (schoolId: string | null) => string | null {
  const identify = useSchoolIdentity()
  return (schoolId) => identify(schoolId)?.color ?? null
}

export function schoolShortName(schoolId: string | null): string {
  if (!schoolId) return '중립'
  return resolveSchoolIdentityNow(schoolId)?.shortName ?? '미확인'
}

/** 서울 자치구 도형 기반 영토 지도. 기존 타일 기록은 자치구별로 합쳐 표시합니다. */
export function TerritoryMap({
  tiles,
  selectedTileId,
  onSelectTile,
  large = false,
}: {
  tiles: CampusTile[]
  selectedTileId?: string | null
  onSelectTile?: (tile: CampusTile) => void
  large?: boolean
}) {
  const flashTileIds = useCampusStore((s) => s.flashTileIds)
  const identify = useSchoolIdentity()
  const mySchoolId = useCampusThemeStore((s) => s.schoolId)
  const districts = useMemo(() => summarizeDistricts(tiles), [tiles])

  return (
    <div data-testid="territory-map" className="relative w-full min-w-0 overflow-auto" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
      <p className="sr-only">서울 25개 자치구 기반 영토전 지도</p>
      <svg
        viewBox="0 0 600 430"
        className={large ? 'h-auto min-w-[1100px] md:min-w-[1400px]' : 'h-auto w-full'}
        aria-label="서울 자치구 기반 영토전 지도"
      >
        <defs>
          <linearGradient id="seoul-map-paper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFDF7" />
            <stop offset="1" stopColor="#F4EFE4" />
          </linearGradient>
          <linearGradient id="seoul-river" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#BFE7E8" />
            <stop offset="0.5" stopColor="#A5D9E0" />
            <stop offset="1" stopColor="#BFE7E8" />
          </linearGradient>
          <filter id="district-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#8D8475" floodOpacity="0.14" />
          </filter>
        </defs>
        <rect x="0" y="0" width="600" height="430" rx="24" fill="url(#seoul-map-paper)" />
        <path d="M0 218 C74 196 122 236 198 218 S326 199 395 220 S523 241 600 210 L600 270 C520 294 456 263 382 279 S235 293 166 268 S72 250 0 278Z" fill="url(#seoul-river)" opacity="0.86" />
        <path d="M0 218 C74 196 122 236 198 218 S326 199 395 220 S523 241 600 210" fill="none" stroke="#86C9D1" strokeWidth="2" opacity="0.9" />
        <path d="M0 278 C72 250 94 276 166 268 S235 293 382 279 S520 294 600 270" fill="none" stroke="#86C9D1" strokeWidth="2" opacity="0.9" />
        <g filter="url(#district-shadow)">
          {districts.map((summary) => {
            const { district, representative, ownerSchoolId, challengerSchoolId } = summary
            const owner = identify(ownerSchoolId)
            const challenger = identify(challengerSchoolId)
            const progress = summary.defenseScore > 0 ? Math.min(1, summary.challengeScore / summary.defenseScore) : 0
            const selected = representative?.id === selectedTileId
            const isMine = Boolean(mySchoolId) && ownerSchoolId === mySchoolId
            const label = `${district.name}, ${owner?.shortName ?? '중립'}${challenger ? `, ${challenger.shortName} 경합` : ''}`

            return (
              <g key={district.id} data-testid="territory-district" data-district-id={district.id}>
                <path
                  d={district.path}
                  role={representative && onSelectTile ? 'button' : 'img'}
                  aria-label={label}
                  aria-pressed={representative && onSelectTile ? selected : undefined}
                  tabIndex={representative && onSelectTile ? 0 : -1}
                  onClick={() => representative && onSelectTile?.(representative)}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && representative) {
                      event.preventDefault()
                      onSelectTile?.(representative)
                    }
                  }}
                  fill={challenger?.color ?? owner?.color ?? '#F8F4EA'}
                  fillOpacity={challenger ? Math.max(0.18, 0.18 + progress * 0.52) : owner ? (isMine ? 0.66 : 0.42) : 0.68}
                  stroke={selected ? '#171717' : challenger ? challenger.color : '#D8CFBF'}
                  strokeWidth={selected ? 3.5 : challenger ? 2.5 : 1.3}
                  strokeDasharray={challenger ? '7 5' : undefined}
                  className={[
                    'transition',
                    representative && onSelectTile ? 'cursor-pointer hover:brightness-105' : '',
                    summary.tiles.some((tile) => flashTileIds.includes(tile.id)) ? 'anim-campus-capture' : '',
                  ].join(' ')}
                />
                <text x={district.labelX} y={district.labelY} textAnchor="middle" fontSize="11" fontWeight="700" fill="#5F594F" pointerEvents="none">
                  {district.name}
                </text>
                {isMine && <text x={district.labelX} y={district.labelY + 16} textAnchor="middle" fontSize="13" fill={owner?.color ?? '#171717'} pointerEvents="none">★</text>}
                {challenger && <g pointerEvents="none"><rect x={district.labelX - 23} y={district.labelY + 20} width="46" height="4" rx="2" fill="#FFFFFF" opacity="0.8" /><rect x={district.labelX - 23} y={district.labelY + 20} width={46 * progress} height="4" rx="2" fill={challenger.color} /></g>}
              </g>
            )
          })}
        </g>
        <text x="24" y="406" fontSize="12" fontWeight="700" fill="#5F594F">서울 25개 자치구 · 한강</text>
      </svg>
    </div>
  )
}

/** 학교별 점령 자치구 수를 설명하는 범례입니다. */
export function TerritoryLegend({ tiles }: { tiles: CampusTile[] }) {
  const identify = useSchoolIdentity()
  const districts = useMemo(() => summarizeDistricts(tiles), [tiles])
  const owners = useMemo(() => {
    const counts = new Map<string, number>()
    for (const district of districts) if (district.ownerSchoolId) counts.set(district.ownerSchoolId, (counts.get(district.ownerSchoolId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [districts])
  const neutral = SEOUL_DISTRICTS.length - owners.reduce((sum, [, count]) => sum + count, 0)
  return (
    <div data-testid="territory-legend" className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-soft">
      {owners.map(([schoolId, count]) => <span key={schoolId} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: identify(schoolId)?.color ?? '#EFE9DC' }} />{`${identify(schoolId)?.shortName ?? '미확인'} ${count}구`}</span>)}
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px] border border-line bg-canvas" />{`중립 ${neutral}구`}</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">▧</span> 경합 (공격 점수로 표시)</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">★</span>내 학교 영토</span>
    </div>
  )
}
