import type { CharacterStage, CharacterVisualState } from '@/types'

/**
 * 캐릭터 SVG 플레이스홀더.
 *
 * references/character-growth-final.jpeg 는 "디자인 기준"이며,
 * 그 시트를 잘라 프로덕션 에셋으로 쓰는 것은 금지되어 있습니다.
 * 실제 WebP·WebM 에셋이 준비되기 전까지, 6단계의 실루엣 차이
 * (목 길이 · 몸통 각도 · 등껍질 크기 · 색 변화)만 분명하게 지킨 자체 도형을 씁니다.
 *
 * 모든 단계는 같은 캔버스(200×200)와 같은 발바닥 기준선(y=178)을 씁니다. (docs/10 §5)
 */

interface StageShape {
  legLen: number
  bodyRx: number
  bodyRy: number
  shellRx: number
  shellRy: number
  neckLen: number
  headR: number
  bodyColor: string
  hasShell: boolean
  hasHorns: boolean
  hasSpots: boolean
  hasJacket: boolean
  hasBackpack: boolean
}

const SHAPES: Record<CharacterStage, StageShape> = {
  1: {
    legLen: 4,
    bodyRx: 44,
    bodyRy: 22,
    shellRx: 50,
    shellRy: 34,
    neckLen: 0,
    headR: 18,
    bodyColor: '#A9C07C',
    hasShell: true,
    hasHorns: false,
    hasSpots: false,
    hasJacket: false,
    hasBackpack: false,
  },
  2: {
    legLen: 12,
    bodyRx: 40,
    bodyRy: 21,
    shellRx: 44,
    shellRy: 28,
    neckLen: 15,
    headR: 17,
    bodyColor: '#A9C07C',
    hasShell: true,
    hasHorns: false,
    hasSpots: false,
    hasJacket: false,
    hasBackpack: false,
  },
  3: {
    legLen: 20,
    bodyRx: 36,
    bodyRy: 21,
    shellRx: 40,
    shellRy: 26,
    neckLen: 40,
    headR: 15,
    bodyColor: '#C7C57A',
    hasShell: true,
    hasHorns: true,
    hasSpots: true,
    hasJacket: false,
    hasBackpack: false,
  },
  4: {
    legLen: 30,
    bodyRx: 32,
    bodyRy: 20,
    shellRx: 31,
    shellRy: 21,
    neckLen: 56,
    headR: 14,
    bodyColor: '#DCC97B',
    hasShell: true,
    hasHorns: true,
    hasSpots: true,
    hasJacket: false,
    hasBackpack: false,
  },
  5: {
    legLen: 44,
    bodyRx: 30,
    bodyRy: 19,
    shellRx: 0,
    shellRy: 0,
    neckLen: 72,
    headR: 13,
    bodyColor: '#F2CA7A',
    hasShell: false,
    hasHorns: true,
    hasSpots: true,
    hasJacket: false,
    hasBackpack: false,
  },
  6: {
    legLen: 48,
    bodyRx: 30,
    bodyRy: 19,
    shellRx: 0,
    shellRy: 0,
    neckLen: 84,
    headR: 13,
    bodyColor: '#F2CA7A',
    hasShell: false,
    hasHorns: true,
    hasSpots: true,
    hasJacket: true,
    hasBackpack: true,
  },
}

/** 자세 상태별 목 기울기(도). 클수록 앞으로 숙인 모습입니다. */
const NECK_TILT: Record<CharacterVisualState, number> = {
  idle: 6,
  warning: 18,
  slouch: 42,
  recover: -4,
  away: 12,
}

/** 목이 몸통 쪽으로 움츠러드는 비율 (1 = 원래 길이) */
const NECK_SCALE: Record<CharacterVisualState, number> = {
  idle: 1,
  warning: 0.92,
  slouch: 0.68,
  recover: 1.06,
  away: 0.9,
}

const GROUND_Y = 178
const CENTER_X = 96

export interface CharacterSvgProps {
  stage: CharacterStage
  state: CharacterVisualState
  className?: string
}

export function CharacterSvg({ stage, state, className }: CharacterSvgProps) {
  const s = SHAPES[stage]
  const tilt = NECK_TILT[state]

  const bodyCy = GROUND_Y - s.legLen - s.bodyRy
  const neckBaseX = CENTER_X + s.bodyRx * 0.5
  const neckBaseY = bodyCy - s.bodyRy * 0.55

  // 자세가 흐트러지면 목이 짧아지고 앞으로 기웁니다. (실루엣 차이를 크게)
  const neckLen = s.neckLen * NECK_SCALE[state]
  const rad = (tilt * Math.PI) / 180
  const headX = neckBaseX + Math.sin(rad) * neckLen
  const headY = neckBaseY - Math.cos(rad) * neckLen

  const legY = GROUND_Y - s.legLen
  const legWidth = Math.max(9, s.bodyRx * 0.26)

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="presentation"
      focusable="false"
    >
      {/* 바닥 그림자 */}
      <ellipse
        cx={CENTER_X}
        cy={GROUND_Y + 4}
        rx={s.bodyRx + 10}
        ry={7}
        fill="#171717"
        opacity={0.08}
      />

      {/* 백팩 — 몸통 뒤 레이어 */}
      {s.hasBackpack && (
        <g>
          <rect
            x={CENTER_X - s.bodyRx - 6}
            y={bodyCy - 16}
            width={26}
            height={36}
            rx={9}
            fill="#C9B08A"
            stroke="#A98F6B"
            strokeWidth={2}
          />
          <rect
            x={CENTER_X - s.bodyRx - 2}
            y={bodyCy - 6}
            width={18}
            height={8}
            rx={3}
            fill="#A98F6B"
          />
        </g>
      )}

      {/* 다리 */}
      {[-0.62, -0.2, 0.2, 0.62].map((offset, index) => (
        <rect
          key={index}
          x={CENTER_X + s.bodyRx * offset - legWidth / 2}
          y={legY}
          width={legWidth}
          height={s.legLen + 6}
          rx={legWidth / 2}
          fill={index % 2 === 0 ? shade(s.bodyColor, -12) : s.bodyColor}
        />
      ))}

      {/* 꼬리 */}
      <path
        d={`M ${CENTER_X - s.bodyRx} ${bodyCy} q -14 6 -10 20`}
        stroke={shade(s.bodyColor, -14)}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />

      {/* 몸통 */}
      <ellipse
        cx={CENTER_X}
        cy={bodyCy}
        rx={s.bodyRx}
        ry={s.bodyRy}
        fill={s.bodyColor}
      />

      {/* 등껍질 */}
      {s.hasShell && (
        <>
          <ellipse
            cx={CENTER_X - 2}
            cy={bodyCy - s.bodyRy * 0.35}
            rx={s.shellRx}
            ry={s.shellRy}
            fill="#6E8955"
            stroke="#55703F"
            strokeWidth={2.5}
          />
          <path
            d={`M ${CENTER_X - s.shellRx * 0.6} ${bodyCy - s.bodyRy * 0.35}
                h ${s.shellRx * 1.2}`}
            stroke="#55703F"
            strokeWidth={2}
            opacity={0.55}
          />
          <path
            d={`M ${CENTER_X - 2} ${bodyCy - s.bodyRy * 0.35 - s.shellRy}
                v ${s.shellRy * 1.7}`}
            stroke="#55703F"
            strokeWidth={2}
            opacity={0.45}
          />
        </>
      )}

      {/* 과잠 */}
      {s.hasJacket && (
        <g>
          <path
            d={`M ${CENTER_X - s.bodyRx * 0.9} ${bodyCy - s.bodyRy * 0.5}
                q ${s.bodyRx * 0.9} ${-s.bodyRy * 0.9} ${s.bodyRx * 1.8} 0
                v ${s.bodyRy * 1.4}
                q ${-s.bodyRx * 0.9} ${s.bodyRy * 0.7} ${-s.bodyRx * 1.8} 0 z`}
            fill="#315E43"
          />
          <path
            d={`M ${CENTER_X} ${bodyCy - s.bodyRy * 0.85} v ${s.bodyRy * 1.7}`}
            stroke="#FBF7EC"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* 얼룩무늬 */}
      {s.hasSpots && (
        <g fill="#D9A254" opacity={0.75}>
          <circle cx={(neckBaseX + headX) / 2 + 1} cy={(neckBaseY + headY) / 2} r={4} />
          <circle
            cx={(neckBaseX + headX) / 2 - 4}
            cy={(neckBaseY + headY) / 2 + neckLen * 0.26}
            r={3.4}
          />
          {!s.hasShell && (
            <>
              <circle cx={CENTER_X + 10} cy={bodyCy - 4} r={4.5} />
              <circle cx={CENTER_X - 12} cy={bodyCy + 3} r={4} />
            </>
          )}
        </g>
      )}

      {/* 목 */}
      {s.neckLen > 0 && (
        <line
          x1={neckBaseX}
          y1={neckBaseY + 4}
          x2={headX}
          y2={headY + s.headR * 0.5}
          stroke={s.bodyColor}
          strokeWidth={s.headR * 1.15}
          strokeLinecap="round"
        />
      )}

      {/* 뿔 */}
      {s.hasHorns && (
        <g stroke="#B98A5A" strokeWidth={3} strokeLinecap="round">
          <line
            x1={headX - 5}
            y1={headY - s.headR * 0.8}
            x2={headX - 7}
            y2={headY - s.headR * 1.5}
          />
          <line
            x1={headX + 5}
            y1={headY - s.headR * 0.8}
            x2={headX + 7}
            y2={headY - s.headR * 1.5}
          />
          <circle cx={headX - 7} cy={headY - s.headR * 1.6} r={2.6} fill="#B98A5A" />
          <circle cx={headX + 7} cy={headY - s.headR * 1.6} r={2.6} fill="#B98A5A" />
        </g>
      )}

      {/* 머리 */}
      <ellipse
        cx={headX}
        cy={headY}
        rx={s.headR * 1.08}
        ry={s.headR}
        fill={s.bodyColor}
      />
      {/* 주둥이 */}
      <ellipse
        cx={headX + s.headR * 0.75}
        cy={headY + s.headR * 0.25}
        rx={s.headR * 0.5}
        ry={s.headR * 0.42}
        fill={shade(s.bodyColor, 16)}
      />

      {/* 눈 */}
      {state === 'away' ? (
        <path
          d={`M ${headX + s.headR * 0.1} ${headY - 2}
              q 4 4 8 0`}
          stroke="#171717"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx={headX + s.headR * 0.5} cy={headY - s.headR * 0.15} r={3.6} fill="#171717" />
          <circle
            cx={headX + s.headR * 0.5 + 1.2}
            cy={headY - s.headR * 0.15 - 1.2}
            r={1.3}
            fill="#FFFFFF"
          />
        </>
      )}

      {/* 회복 중 반짝임 */}
      {state === 'recover' && (
        <g fill="#5F8FF7">
          <circle cx={headX + 22} cy={headY - 16} r={3} opacity={0.8} />
          <circle cx={headX + 30} cy={headY - 4} r={2} opacity={0.6} />
        </g>
      )}
    </svg>
  )
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value))
}

/** hex 색을 밝게(양수) 또는 어둡게(음수) 조정합니다. */
function shade(hex: string, amount: number): string {
  const num = Number.parseInt(hex.slice(1), 16)
  const r = clamp(((num >> 16) & 0xff) + amount)
  const g = clamp(((num >> 8) & 0xff) + amount)
  const b = clamp((num & 0xff) + amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
