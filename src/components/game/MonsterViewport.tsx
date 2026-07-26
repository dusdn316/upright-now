import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/a11y/useReducedMotion'
import type { MonsterThemeId } from '@/features/modes/modeStore'

/**
 * 괴물 표시 단일 진입점 — 승인 phase 1~4 이미지 + CSS 연출.
 *
 * 이미지는 idle 한 장이 기준이며 attack/hit/defeated/phase-up 은
 * index.css 의 monster-* 클래스로 표현합니다. (죽음·파손 표현 없음 —
 * defeated 는 주저앉기+투명도, phase-up 은 확대+빛 링)
 * 이미지가 없으면(로드 실패 포함) 기존 이모지 폴백을 유지합니다.
 */
export type MonsterVisual = 'idle' | 'attack' | 'hit' | 'heavy-hit' | 'defeated'

const EMOJI_FALLBACK: Record<MonsterThemeId, string> = {
  bookmong: '📚',
  neulmong: '🛋️',
  komong: '🗂️',
}

/** 테마별 방해/연출 파티클 (승인 이미지와 별개 — 이모지·CSS 만 사용) */
const THEME_PARTICLES: Record<MonsterThemeId, string[]> = {
  bookmong: ['📖', '📄'],
  neulmong: ['🛏️', '💤'],
  komong: ['🔌', '🗒️', '💬'],
}

export function monsterAssetSrc(theme: MonsterThemeId, phase: number, size: 256 | 512 = 512): string {
  const p = String(Math.min(4, Math.max(1, phase))).padStart(2, '0')
  return `/assets/monsters/${theme}/phase-${p}/idle-${size}.webp`
}

export function MonsterViewport({
  theme,
  phase,
  visual = 'idle',
  hitTick = 0,
  size = 96,
  className = '',
}: {
  theme: MonsterThemeId
  phase: number
  visual?: MonsterVisual
  /** 값이 바뀌면 피격 연출을 1회 재생 */
  hitTick?: number
  size?: number
  className?: string
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [broken, setBroken] = useState(false)
  const [hitting, setHitting] = useState(false)
  const [phaseFlash, setPhaseFlash] = useState(false)
  const prevPhase = useRef(phase)

  useEffect(() => {
    if (hitTick <= 0) return
    setHitting(true)
    const t = window.setTimeout(() => setHitting(false), 300)
    return () => window.clearTimeout(t)
  }, [hitTick])

  // phase 상승 → 진화 연출 (이름 표시는 호출부 텍스트가 담당)
  useEffect(() => {
    if (phase > prevPhase.current) {
      setPhaseFlash(true)
      const t = window.setTimeout(() => setPhaseFlash(false), 900)
      prevPhase.current = phase
      return () => window.clearTimeout(t)
    }
    prevPhase.current = phase
  }, [phase])

  const state = hitting ? (visual === 'heavy-hit' ? 'heavy-hit' : 'hit') : visual
  const particles = THEME_PARTICLES[theme]

  return (
    <span
      className={[
        'relative inline-flex items-center justify-center',
        `monster-state-${state}`,
        phaseFlash ? 'monster-phase-up' : '',
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
      data-monster={theme}
      data-phase={phase}
      aria-hidden="true"
    >
      {!broken ? (
        <img
          src={monsterAssetSrc(theme, phase, size > 200 ? 512 : 256)}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="monster-img h-full w-full object-contain"
        />
      ) : (
        <span style={{ fontSize: size * 0.55 }}>{EMOJI_FALLBACK[theme]}</span>
      )}

      {/* 피격 링 — 색·모션은 CSS, reduced-motion 은 정적 링만 */}
      {hitting && (
        <span
          className={
            state === 'heavy-hit'
              ? 'pointer-events-none absolute inset-0 rounded-full ring-4 ring-coral/70 ring-offset-2 ring-offset-yellow/40'
              : 'pointer-events-none absolute inset-0 rounded-full ring-4 ring-coral/60'
          }
        />
      )}

      {/* 공격 시 테마 파티클 */}
      {!reducedMotion && state === 'attack' && (
        <span className="pointer-events-none absolute inset-0">
          {particles.slice(0, 2).map((p, i) => (
            <span
              key={p}
              className="monster-particle absolute text-sm"
              style={{ left: `${18 + i * 46}%`, top: `${12 + i * 10}%` }}
            >
              {p}
            </span>
          ))}
        </span>
      )}
      {phaseFlash && (
        <span className="pointer-events-none absolute inset-0 rounded-full ring-8 ring-yellow/50" />
      )}
    </span>
  )
}
