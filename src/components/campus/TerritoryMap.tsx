import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { CAMPUS_ZONE_META, getSchoolPreset } from '@/constants/campus'
import { tileLabel } from '@/features/campus/campusMap'
import { shapeFor } from '@/features/campus/islandMap'
import { captureProgress, tileStatus } from '@/features/campus/territory'
import { useCampusStore } from '@/features/campus/campusStore'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import { resolveCampusTheme } from '@/features/campus/theme'
import type { CampusTile } from '@/features/campus/types'

/**
 * 자체 제작한 가상 캠퍼스 타일 지도 (12×8).
 *
 * 실제 서울 지도나 특정 학교 부지를 복제하지 않습니다.
 * 1280·1440 폭에서 가로 스크롤이 생기지 않도록 컨테이너 폭 기준 grid 로 그립니다.
 */
const ZONE_TINT: Record<string, string> = {
  library: '#EFE7D6',
  plaza: '#E8E2D2',
  lecture: '#F2ECDD',
  lawn: '#E4EEDB',
  cafe: '#F6E7DE',
}

export function useSchoolColor(): (schoolId: string | null) => string | null {
  const mySchoolId = useCampusThemeStore((s) => s.schoolId)
  const myCustomColor = useCampusThemeStore((s) => s.customColor)

  return (schoolId) => {
    if (!schoolId) return null
    if (schoolId === mySchoolId) {
      return resolveCampusTheme(schoolId, myCustomColor)?.primary ?? null
    }
    return getSchoolPreset(schoolId)?.primary ?? null
  }
}

export function schoolShortName(schoolId: string | null): string {
  if (!schoolId) return '중립'
  return getSchoolPreset(schoolId)?.short ?? '기타 학교'
}

export function TerritoryMap({
  tiles,
  selectedTileId,
  onSelectTile,
}: {
  tiles: CampusTile[]
  selectedTileId?: string | null
  onSelectTile?: (tile: CampusTile) => void
}) {
  const flashTileIds = useCampusStore((s) => s.flashTileIds)
  const colorOf = useSchoolColor()
  const mySchoolId = useCampusThemeStore((s) => s.schoolId)

  // 섬 표현 계층 — territory 폴리곤이 있는 타일만 그립니다.
  // tileId 는 기존 12×8 모델 그대로라 저장 데이터가 이어집니다.
  const ordered = useMemo(
    () =>
      [...tiles]
        .filter((t) => shapeFor(t) !== null)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    [tiles],
  )
  const [bgBroken, setBgBroken] = useState(false)

  return (
    <div
      data-testid="territory-map"
      className="relative w-full min-w-0 overflow-auto"
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
    >
      <p className="sr-only">{`가상 캠퍼스 섬 지도 (territory ${ordered.length}곳)`}</p>
      <svg
        viewBox="0 0 1536 1024"
        className="h-auto w-full"
        aria-label="가상 캠퍼스 섬 지도"
      >
        {/* 배경 — 최종 이미지는 별도 제작 후 교체 (없으면 자체 SVG 섬) */}
        {!bgBroken ? (
          <image
            href="/assets/campus/campus-map-bg-1024.webp"
            x="0"
            y="0"
            width="1536"
            height="1024"
            preserveAspectRatio="xMidYMid slice"
            onError={() => setBgBroken(true)}
          />
        ) : null}
        {/* 배경의 네모 칸은 장식 — 실제 클릭 영역은 아래 불규칙 polygon */}
        <path
          d="M 154 488 C 102 268 333 98 614 90 C 947 66 1357 146 1434 390 C 1510 634 1306 902 947 950 C 589 998 205 854 154 585 Z"
          fill={bgBroken ? '#EAE4D3' : 'transparent'}
          stroke={bgBroken ? '#D9D1BE' : 'transparent'}
          strokeWidth="10"
        />
        {/* islandMap 좌표계(120×84)를 배경 해상도(1536×1024)로 스케일 */}
        <g transform="scale(12.8, 12.190476)">
        {ordered.map((tile) => {
        const status = tileStatus(tile)
        const owner = colorOf(tile.ownerSchoolId)
        const challenger = colorOf(tile.challengerSchoolId)
        const progress = captureProgress(tile)
        const zone = CAMPUS_ZONE_META[tile.zone]
        const isMine = Boolean(mySchoolId) && tile.ownerSchoolId === mySchoolId
        const selected = tile.id === selectedTileId

        const style: CSSProperties = {
          backgroundColor: owner ?? ZONE_TINT[tile.zone] ?? '#EFE9DC',
          ...(status === 'contested' && challenger
            ? ({ '--campus-contested': challenger } as CSSProperties)
            : {}),
        }

        const label = [
          tileLabel(tile, zone.label),
          `점령 ${schoolShortName(tile.ownerSchoolId)}`,
          status === 'contested'
            ? `경합 중 (${schoolShortName(tile.challengerSchoolId)} 진행도 ${Math.round(progress * 100)}%)`
            : `진행도 ${Math.round(progress * 100)}%`,
          isMine ? '내 학교 영토' : '',
        ]
          .filter(Boolean)
          .join(', ')

        const shape = shapeFor(tile)!
        const flashing = flashTileIds.includes(tile.id)
        return (
          <g key={tile.id}>
            <polygon
              data-testid="territory-tile"
              data-tile-id={tile.id}
              data-tile-status={status}
              data-zone={tile.zone}
              data-owner={tile.ownerSchoolId ?? 'none'}
              data-challenger={tile.challengerSchoolId ?? 'none'}
              role={onSelectTile ? 'button' : 'img'}
              aria-label={`${shape.name} — ${label}`}
              aria-pressed={onSelectTile ? selected : undefined}
              tabIndex={onSelectTile ? 0 : -1}
              onClick={() => onSelectTile?.(tile)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectTile?.(tile)
                }
              }}
              points={shape.points}
              fill={owner ?? ZONE_TINT[tile.zone] ?? '#EFE9DC'}
              fillOpacity={owner ? (isMine ? 0.52 : 0.34) : 0.28}
              stroke={
                status === 'contested'
                  ? (challenger ?? '#FF6464')
                  : selected
                    ? '#171717'
                    : '#ffffff'
              }
              strokeWidth={selected ? 1.2 : 0.6}
              strokeDasharray={status === 'contested' ? '2 1.2' : undefined}
              className={[
                'transition',
                flashing ? 'anim-campus-capture' : '',
                onSelectTile ? 'cursor-pointer hover:brightness-110' : '',
              ].join(' ')}
              style={style}
            />
            {/* 색만으로 정보를 전달하지 않기 위한 보조 표시 */}
            {isMine && (
              <text
                x={shape.cx}
                y={shape.cy + 1.4}
                textAnchor="middle"
                fontSize="3.6"
                fontWeight="900"
                fill="#ffffff"
                aria-hidden="true"
                pointerEvents="none"
              >
                ★
              </text>
            )}
            {status === 'contested' && !isMine && (
              <rect
                aria-hidden="true"
                pointerEvents="none"
                x={shape.cx - 4}
                y={shape.cy + 3.4}
                width={8 * Math.max(0.05, progress)}
                height={1}
                rx={0.5}
                fill={challenger ?? '#FF6464'}
              />
            )}
          </g>
        )
      })}
        </g>
      </svg>
    </div>
  )
}

/** 지도 범례 — 학교 색과 상태 표시를 함께 설명합니다. */
export function TerritoryLegend({ tiles }: { tiles: CampusTile[] }) {
  const colorOf = useSchoolColor()
  const owners = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tile of tiles) {
      if (!tile.ownerSchoolId) continue
      counts.set(tile.ownerSchoolId, (counts.get(tile.ownerSchoolId) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [tiles])

  const neutral = tiles.filter((t) => !t.ownerSchoolId).length

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-soft">
      {owners.map(([schoolId, count]) => (
        <span key={schoolId} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ backgroundColor: colorOf(schoolId) ?? '#EFE9DC' }}
          />
          {`${schoolShortName(schoolId)} ${count}`}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-[3px] border border-line bg-canvas"
        />
        {`중립 ${neutral}`}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="campus-tile--contested inline-block h-3 w-3 rounded-[3px] bg-canvas"
        />
        경합 (점령 진행도 80% 이상)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true">★</span>내 학교 영토
      </span>
    </div>
  )
}
