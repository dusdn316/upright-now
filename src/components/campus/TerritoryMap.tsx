import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { CAMPUS_ZONE_META, getSchoolPreset } from '@/constants/campus'
import { MAP_COLS, MAP_ROWS, tileLabel } from '@/features/campus/campusMap'
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

  const ordered = useMemo(
    () => [...tiles].sort((a, b) => a.y - b.y || a.x - b.x),
    [tiles],
  )

  return (
    <fieldset
      data-testid="territory-map"
      className="m-0 grid w-full min-w-0 gap-[3px] border-0 p-0"
      style={{ gridTemplateColumns: `repeat(${MAP_COLS}, minmax(0, 1fr))` }}
    >
      <legend className="sr-only">{`가상 캠퍼스 지도 ${MAP_COLS}×${MAP_ROWS}`}</legend>
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

        return (
          <button
            key={tile.id}
            type="button"
            data-testid="territory-tile"
            data-tile-id={tile.id}
            data-tile-status={status}
            data-zone={tile.zone}
            data-owner={tile.ownerSchoolId ?? 'none'}
            data-challenger={tile.challengerSchoolId ?? 'none'}
            aria-label={label}
            aria-pressed={onSelectTile ? selected : undefined}
            onClick={() => onSelectTile?.(tile)}
            /*
              읽기 전용 지도(선택 핸들러 없음)에서는 96개 타일이 Tab 순서를
              가로막지 않게 합니다. 스크린리더 탐색에는 그대로 노출됩니다.
            */
            tabIndex={onSelectTile ? 0 : -1}
            className={[
              'relative aspect-square min-w-0 rounded-[4px] transition',
              status === 'contested' ? 'campus-tile--contested' : '',
              flashTileIds.includes(tile.id) ? 'anim-campus-capture' : '',
              selected ? 'ring-2 ring-ink ring-offset-1' : '',
              onSelectTile ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
            ].join(' ')}
            style={style}
          >
            {/* 색만으로 정보를 전달하지 않기 위한 보조 표시 */}
            {isMine && (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white/90"
              >
                ★
              </span>
            )}
            {status === 'contested' && !isMine && (
              <span
                aria-hidden="true"
                className="absolute right-0 bottom-0 left-0 h-[3px] rounded-b-[4px]"
                style={{
                  backgroundColor: challenger ?? '#FF6464',
                  width: `${Math.round(progress * 100)}%`,
                }}
              />
            )}
          </button>
        )
      })}
    </fieldset>
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
