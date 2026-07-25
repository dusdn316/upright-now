/**
 * 스트레칭 동작 실루엣 — 단순 SVG 스틱 피겨 + 방향 화살표.
 * 최종 모션 에셋이 준비되기 전의 자체 그래픽입니다. 외부 이미지를 쓰지 않습니다.
 */
const STROKE = '#315E43'
const ARROW = '#F45B8D'

function Arrow({ d }: { d: string }) {
  return (
    <path
      d={d}
      stroke={ARROW}
      strokeWidth={5}
      fill="none"
      strokeLinecap="round"
      markerEnd="url(#stretch-arrow)"
    />
  )
}

function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" role="presentation">
      <defs>
        <marker
          id="stretch-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ARROW} />
        </marker>
      </defs>
      <g stroke={STROKE} strokeWidth={7} strokeLinecap="round" fill="none">
        {children}
      </g>
    </svg>
  )
}

/** 앉은 상반신 (머리·몸통·의자) */
function SeatedTorso({ headX = 80 }: { headX?: number }) {
  return (
    <>
      <circle cx={headX} cy={38} r={16} fill="#E4EEDB" />
      <path d={`M ${headX} 54 L 80 100`} />
      <path d="M 62 138 h 40" strokeWidth={5} opacity={0.4} />
      <path d="M 80 100 L 70 132 M 80 100 L 92 132" strokeWidth={6} />
    </>
  )
}

const FIGURES: Record<string, React.ReactNode> = {
  /** 어깨 천천히 돌리기 — 어깨 위 원형 화살표 */
  'shoulder-roll': (
    <Base>
      <SeatedTorso />
      <path d="M 80 74 L 52 88 M 80 74 L 108 88" strokeWidth={6} />
      <Arrow d="M 40 82 a 14 14 0 1 1 6 -20" />
      <Arrow d="M 120 62 a 14 14 0 1 1 -6 20" />
    </Base>
  ),
  /** 날개뼈 가볍게 모으기 — 팔꿈치 뒤로, 안쪽 화살표 */
  'scapular-squeeze': (
    <Base>
      <SeatedTorso />
      <path d="M 80 74 L 50 70 L 42 92 M 80 74 L 110 70 L 118 92" strokeWidth={6} />
      <Arrow d="M 34 96 L 58 104" />
      <Arrow d="M 126 96 L 102 104" />
    </Base>
  ),
  /** 손목·전완 움직이기 — 손목 원형 화살표 */
  'wrist-forearm': (
    <Base>
      <SeatedTorso />
      <path d="M 80 74 L 54 96 L 44 118 M 80 74 L 106 96 L 116 118" strokeWidth={6} />
      <Arrow d="M 34 118 a 11 11 0 1 0 20 -4" />
      <Arrow d="M 126 118 a 11 11 0 1 1 -20 -4" />
    </Base>
  ),
  /** 앉은 상태 등 회전 — 몸통 좌우 회전 화살표 */
  'seated-twist': (
    <Base>
      <SeatedTorso />
      <path d="M 58 82 L 102 66" strokeWidth={6} />
      <Arrow d="M 46 58 a 34 20 0 0 1 34 -14" />
      <Arrow d="M 114 104 a 34 20 0 0 1 -34 14" />
    </Base>
  ),
  /** 목 좌우로 천천히 — 머리 좌우 화살표 (원형 회전 아님) */
  'neck-turn': (
    <Base>
      <SeatedTorso />
      <path d="M 80 74 L 56 88 M 80 74 L 104 88" strokeWidth={6} />
      <Arrow d="M 58 30 L 44 38" />
      <Arrow d="M 102 30 L 116 38" />
    </Base>
  ),
  /** 일어서기·종아리 올리기 — 선 자세 + 위 화살표 */
  'calf-raise': (
    <Base>
      <circle cx={80} cy={30} r={14} fill="#E4EEDB" />
      <path d="M 80 44 L 80 96" />
      <path d="M 80 60 L 60 76 M 80 60 L 100 76" strokeWidth={6} />
      <path d="M 80 96 L 70 128 L 70 138 M 80 96 L 90 128 L 90 138" strokeWidth={6} />
      <Arrow d="M 116 128 L 116 100" />
      <path d="M 56 146 h 48" strokeWidth={4} opacity={0.4} />
    </Base>
  ),
}

export function StretchFigure({ routineId }: { routineId: string }) {
  return (
    <div className="flex h-40 w-40 items-center justify-center rounded-full bg-surface">
      {FIGURES[routineId] ?? FIGURES['shoulder-roll']}
    </div>
  )
}
