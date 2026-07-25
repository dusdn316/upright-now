import { useEffect, useRef, useState } from 'react'
import { CharacterSvg } from './CharacterSvg'
import {
  describeCharacter,
  resolveAssetState,
  resolveCharacterAsset,
  type CharacterAssetState,
  type CharacterVisualIntent,
} from '@/assets/manifest/characterAssetManifest'
import { usePrefersReducedMotion } from '@/lib/a11y/useReducedMotion'
import { useQaFlagsStore } from '@/features/qa-lab/qaFlagsStore'
import type {
  CharacterStage,
  CharacterVisualState,
  PostureState,
} from '@/types'

/**
 * 캐릭터 표시의 단일 진입점 — docs/10_CHARACTER_ASSET_SPEC.md §7
 *
 * stage(장기 성장)와 자세 상태는 서로 다른 소스에서 오며 절대 섞이지 않습니다.
 * 폴백: 정확한 상태 이미지 → 해당 단계 idle 이미지 → CharacterSvg
 */
export interface CharacterViewportProps {
  stage: CharacterStage
  /** 자세 엔진이 준 상태 */
  postureState?: PostureState
  /** 게임이 지정한 표현. attack 은 attackTick 으로도 자동 지정됩니다. */
  visualState?: CharacterVisualIntent
  /** 값이 바뀌면 공격 이미지를 잠깐 보여준 뒤 원래 상태로 돌아옵니다. */
  attackTick?: number
  /** 공격 이미지 유지 시간 — 메인 900ms, PIP 축약 연출은 1500ms 내에서 사용 */
  attackDurationMs?: number
  size?: number
  className?: string
  /** 성장 타임라인처럼 장식으로만 쓸 때 */
  decorative?: boolean
}


const CROSSFADE_MS = 220

/** 이미지가 없을 때 쓰는 SVG 폴백용 상태 변환 */
const ASSET_TO_SVG: Record<CharacterAssetState, CharacterVisualState> = {
  idle: 'idle',
  warning: 'warning',
  slouch: 'slouch',
  recover: 'recover',
  attack: 'recover',
  away: 'away',
}

export function CharacterViewport({
  stage,
  postureState = 'good',
  visualState = 'idle',
  attackTick = 0,
  attackDurationMs = 900,
  size = 200,
  className = '',
  decorative = false,
}: CharacterViewportProps) {
  const reducedMotion = usePrefersReducedMotion()
  const imagesBroken = useQaFlagsStore((s) => s.characterImagesBroken)
  const [attacking, setAttacking] = useState(false)
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  // 회복 성공 → 공격 이미지 → 원래 상태
  useEffect(() => {
    if (attackTick <= 0) return
    setAttacking(true)
    const timer = window.setTimeout(() => setAttacking(false), attackDurationMs)
    return () => window.clearTimeout(timer)
  }, [attackTick, attackDurationMs])

  const assetState = resolveAssetState(
    postureState,
    attacking ? 'attack' : visualState,
  )
  const resolved = imagesBroken
    ? null
    : resolveCharacterAsset(stage, assetState, unavailable)

  // 대체 텍스트는 요청한 상태가 아니라 실제로 보이는 상태를 설명합니다.
  const shownState = resolved ? resolved.state : assetState
  const alt = describeCharacter(stage, shownState)

  // crossfade — 이전 이미지를 잠깐 겹쳐 둡니다.
  const [current, setCurrent] = useState(resolved?.src ?? null)
  const [previous, setPrevious] = useState<string | null>(null)
  const fadeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const next = resolved?.src ?? null
    setCurrent((prevCurrent) => {
      if (prevCurrent === next) return prevCurrent
      if (!reducedMotion && prevCurrent) setPrevious(prevCurrent)
      return next
    })
  }, [resolved?.src, reducedMotion])

  useEffect(() => {
    if (previous === null) return
    window.clearTimeout(fadeTimer.current)
    fadeTimer.current = window.setTimeout(
      () => setPrevious(null),
      CROSSFADE_MS + 20,
    )
    return () => window.clearTimeout(fadeTimer.current)
  }, [previous])

  const markUnavailable = (src: string) =>
    setUnavailable((prev) => {
      if (prev.has(src)) return prev
      const next = new Set(prev)
      next.add(src)
      return next
    })

  const transition = reducedMotion ? 'none' : `opacity ${CROSSFADE_MS}ms ease-out`

  // away·unstable 에서는 현재 단계 idle 이미지에 투명도·채도 감소를 적용합니다.
  const dimClass =
    postureState === 'away'
      ? 'opacity-55 saturate-50'
      : postureState === 'unstable'
        ? 'saturate-[0.4]'
        : ''

  return (
    <figure
      className={`relative m-0 shrink-0 ${dimClass} ${className}`}
      style={{ width: size, height: size }}
      data-asset-state={resolved ? resolved.state : 'svg-fallback'}
    >
      {current ? (
        <>
          {previous && previous !== current && (
            <img
              key={previous}
              src={previous}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0"
              style={{ transition }}
            />
          )}
          <img
            key={current}
            src={current}
            alt={decorative ? '' : alt}
            aria-hidden={decorative || undefined}
            draggable={false}
            onError={() => markUnavailable(current)}
            className="anim-fade-in absolute inset-0 h-full w-full object-contain"
            style={{ transition }}
          />
        </>
      ) : (
        // 이미지를 하나도 못 쓰면 도형 폴백으로 계속 진행합니다. (AT-08)
        <CharacterSvg
          stage={stage}
          state={ASSET_TO_SVG[assetState]}
          className="h-full w-full"
        />
      )}

      {/* 회복 성공 — 짧은 코랄·노랑 에너지 효과 (attack 이미지 위에 겹칩니다) */}
      {attacking &&
        (reducedMotion ? (
          <span
            aria-hidden="true"
            data-testid="recovery-effect-static"
            className="pointer-events-none absolute inset-0 rounded-full ring-8 ring-yellow/60"
          />
        ) : (
          <span
            aria-hidden="true"
            data-testid="recovery-effect"
            className="pointer-events-none absolute inset-0"
          >
            <span className="energy-burst absolute inset-[10%] rounded-full" />
          </span>
        ))}

      {/* 색·이미지 외에 텍스트로도 상태를 전달합니다. (docs/10 §9) */}
      <figcaption className="sr-only">{alt}</figcaption>
    </figure>
  )
}
