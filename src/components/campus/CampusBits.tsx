import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { CAMPUS_COPY, CAMPUS_PATTERN_LABEL } from '@/constants/campus'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCampusTheme } from '@/features/campus/campusThemeStore'
import type { CampusPatternId, CampusThemeTokens } from '@/features/campus/types'

/**
 * 캠퍼스 테마 표시 조각들.
 *
 * 모든 컴포넌트는 학교를 고르지 않았거나 플래그가 꺼져 있으면 아무것도 그리지 않습니다.
 * 학교 이름 텍스트와 일반 패턴만 사용하고, 공식 로고·마스코트는 쓰지 않습니다.
 */

/** 학교 배지 — 프로필·공유 카드·배너에서 같은 모양을 씁니다. */
export function CampusSchoolBadge({
  theme,
  size = 'md',
  showColorSource = false,
}: {
  theme: CampusThemeTokens
  size?: 'sm' | 'md'
  showColorSource?: boolean
}) {
  const style: CSSProperties = {
    backgroundColor: theme.primary,
    color: theme.onPrimary,
  }
  return (
    <span
      data-testid="campus-school-badge"
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      ].join(' ')}
      style={style}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: theme.onPrimary, opacity: 0.75 }}
      />
      {theme.short}
      {showColorSource && (
        <span className="font-semibold opacity-80">
          {theme.colorSource === 'user-defined' ? '· 직접 고른 색' : '· 프로토타입 프리셋'}
        </span>
      )}
      <span className="sr-only">{` — ${theme.schoolName} · 비공식 캠퍼스 테마`}</span>
    </span>
  )
}

/** 사이드바 프로필 옆 배지 — 플래그·선택이 없으면 렌더하지 않습니다. */
export function CampusProfileBadge() {
  const theme = useCampusTheme()
  if (!featureFlags.campusTheme || !theme) return null
  return <CampusSchoolBadge theme={theme} size="sm" />
}

export type CampusBackdropKind = 'library' | 'exam' | 'plain'

/**
 * 도서관 배경 패턴 / 시험기간 배경.
 * 자식 요소를 감싸고 뒤에 패턴만 깔아 줍니다.
 */
export function CampusBackdrop({
  kind = 'library',
  pattern,
  className = '',
  children,
}: {
  kind?: CampusBackdropKind
  pattern?: CampusPatternId
  className?: string
  children: ReactNode
}) {
  const theme = useCampusTheme()
  const active = featureFlags.campusTheme && theme !== null
  const resolved = pattern ?? theme?.pattern ?? 'grid'

  return (
    <div
      data-testid="campus-backdrop"
      data-campus-backdrop={active ? kind : 'off'}
      className={[
        'relative overflow-hidden',
        active && kind !== 'plain' ? `campus-backdrop--${kind}` : '',
        className,
      ].join(' ')}
      style={
        active && theme
          ? ({ '--campus-primary': theme.primary } as CSSProperties)
          : undefined
      }
    >
      {active && kind !== 'plain' && (
        <span aria-hidden="true" className={`campus-pattern campus-pattern--${resolved}`} />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

/** 친구 방 상단 배너 */
export function CampusRoomBanner() {
  const theme = useCampusTheme()
  if (!featureFlags.campusTheme || !theme) return null

  return (
    <div
      data-testid="campus-room-banner"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3"
      style={{ backgroundColor: theme.soft, border: `1px solid ${theme.softStrong}` }}
    >
      <div className="flex items-center gap-2">
        <CampusSchoolBadge theme={theme} />
        <p className="text-sm font-bold" style={{ color: theme.deep }}>
          {`${theme.schoolName} 테마로 함께 집중해요`}
        </p>
      </div>
      <p className="text-[11px] text-ink-soft">{CAMPUS_COPY.unofficialTheme}</p>
    </div>
  )
}

/** 결과 공유 카드 테두리 */
export function CampusShareCardFrame({ children }: { children: ReactNode }) {
  const theme = useCampusTheme()
  if (!featureFlags.campusTheme || !theme) return <>{children}</>

  return (
    <div
      data-testid="campus-share-frame"
      className="rounded-card p-[3px]"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.softStrong})`,
      }}
    >
      <div className="rounded-[calc(var(--radius-card)-2px)] bg-surface">{children}</div>
    </div>
  )
}

/** 비공식 프로토타입 안내 — 캠퍼스 화면 어디에서나 같은 문구를 씁니다. */
export function CampusUnofficialNotice({
  lines = [CAMPUS_COPY.unofficialGame, CAMPUS_COPY.noLogo],
  className = '',
}: {
  lines?: string[]
  className?: string
}) {
  return (
    <div
      data-testid="campus-unofficial-notice"
      className={[
        'rounded-2xl border border-line bg-canvas px-4 py-3 text-xs leading-relaxed text-ink-soft',
        className,
      ].join(' ')}
    >
      <p className="flex items-center gap-1.5 font-bold text-ink">
        <Icon name="shield" size={14} />
        비공식 프로토타입 안내
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line}>· {line}</li>
        ))}
      </ul>
    </div>
  )
}

/** 색 출처 표시 — 임의 공식 색상이라고 주장하지 않습니다. */
export function CampusColorSourceNote({ theme }: { theme: CampusThemeTokens }) {
  return (
    <p className="text-xs text-ink-soft">
      {theme.colorSource === 'user-defined'
        ? CAMPUS_COPY.colorSourceCustom
        : CAMPUS_COPY.colorSourcePreset}
      {` (${theme.colorLabel} · ${CAMPUS_PATTERN_LABEL[theme.pattern]} 패턴)`}
    </p>
  )
}
