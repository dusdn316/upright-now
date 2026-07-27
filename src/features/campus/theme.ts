import {
  CAMPUS_SCHOOLS,
  CUSTOM_DEFAULT_COLOR,
  CUSTOM_SCHOOL_ID,
  getSchoolPreset,
} from '@/constants/campus'
import type { CampusThemeTokens } from './types'

/** 앱 캔버스 색 — soft 배경을 만들 때 섞는 기준입니다. (src/index.css --color-canvas) */
const CANVAS = '#FBF7EC'
const INK = '#171717'

export function normalizeHexColor(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  const expanded =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null
  return `#${expanded.toUpperCase()}`
}

function toRgb(hex: string): [number, number, number] {
  const normalized = normalizeHexColor(hex) ?? CUSTOM_DEFAULT_COLOR
  const value = normalized.slice(1)
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** a 를 ratio 비율로, b 를 (1-ratio) 비율로 섞습니다. */
export function mixHex(a: string, b: string, ratio: number): string {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  const t = Math.max(0, Math.min(1, ratio))
  return toHex([ar * t + br * (1 - t), ag * t + bg * (1 - t), ab * t + bb * (1 - t)])
}

/** WCAG 상대 휘도 */
export function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = toRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

/** 배경색 위에서 대비가 더 높은 글자색을 고릅니다. (색만으로 정보를 전달하지 않기 위한 보조) */
export function readableTextColor(background: string): string {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, INK)
    ? '#FFFFFF'
    : INK
}

/**
 * 학교 선택 → 테마 토큰.
 * 학교를 고르지 않았거나 알 수 없는 id 면 null 을 돌려주고, 화면은 기본 색을 씁니다.
 */
export function resolveCampusTheme(
  schoolId: string | null | undefined,
  customColor?: string | null,
): CampusThemeTokens | null {
  const preset =
    getSchoolPreset(schoolId) ??
    // 커스텀 stable key(custom-xxxx)는 '기타 / 직접 설정' 프리셋으로 그립니다.
    (schoolId?.startsWith('custom') ? getSchoolPreset('custom') : undefined)
  if (!preset) return null

  const isCustom = Boolean(preset.custom)
  const primary =
    (isCustom ? normalizeHexColor(customColor ?? '') : null) ??
    normalizeHexColor(preset.primary) ??
    CUSTOM_DEFAULT_COLOR

  return {
    schoolId: preset.id,
    schoolName: preset.name,
    short: preset.short,
    primary,
    soft: mixHex(primary, CANVAS, 0.1),
    softStrong: mixHex(primary, CANVAS, 0.22),
    onPrimary: readableTextColor(primary),
    // 연한 프리셋을 골라도 글자 대비가 유지되도록 어두운 파생색을 함께 둡니다.
    deep: relativeLuminance(primary) > 0.35 ? mixHex(primary, INK, 0.55) : primary,
    colorLabel: isCustom ? '직접 고른 색' : preset.colorLabel,
    pattern: preset.pattern,
    colorSource: isCustom ? 'user-defined' : preset.colorSource,
  }
}

/** 학교 목록 — 기타 / 직접 설정은 항상 마지막입니다. */
export function listSchools() {
  return CAMPUS_SCHOOLS
}

export function isCustomSchool(schoolId: string | null | undefined): boolean {
  // 'custom'(구버전) 과 'custom-xxxx'(stable key) 모두 커스텀입니다.
  return schoolId === CUSTOM_SCHOOL_ID || Boolean(schoolId?.startsWith('custom-'))
}
