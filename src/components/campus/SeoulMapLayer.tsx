import type { ReactNode } from 'react'

/**
 * 서울 영토전의 지도 베이스 레이어.
 *
 * 실제 행정경계 데이터를 복제하지 않는 프로토타입용 벡터 레이어입니다.
 * 한강과 25개 자치구의 상대적 위치를 보여 주고, 실제 영토 타일은
 * 이 레이어 위에 별도로 렌더링합니다. 외부 지도 API 키가 필요 없습니다.
 */
const DISTRICTS = [
  ['도봉구', 150, 155], ['노원구', 260, 145], ['강북구', 365, 180], ['은평구', 95, 275],
  ['성북구', 330, 285], ['중랑구', 500, 240], ['서대문구', 170, 390], ['종로구', 305, 385],
  ['동대문구', 440, 365], ['마포구', 75, 500], ['중구', 330, 485], ['성동구', 475, 475],
  ['광진구', 590, 435], ['양천구', 85, 650], ['강서구', 105, 585], ['구로구', 260, 665],
  ['영등포구', 295, 575], ['동작구', 405, 650], ['금천구', 350, 770], ['관악구', 470, 755],
  ['서초구', 580, 675], ['강남구', 720, 635], ['송파구', 840, 555], ['강동구', 955, 475],
  ['용산구', 430, 555],
] as const

function Marker({ x, y, label, children }: { x: number; y: number; label: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label={label}>
      <circle r="18" fill="#fff" fillOpacity="0.9" stroke="#5E77B8" strokeWidth="3" />
      {children}
      <text y="34" textAnchor="middle" fontSize="15" fontWeight="800" fill="#28324A">
        {label}
      </text>
    </g>
  )
}

export function SeoulMapLayer() {
  return (
    <g data-testid="seoul-map-layer" aria-label="서울 지도 베이스">
      <rect x="0" y="0" width="1100" height="900" fill="#EAF2F0" fillOpacity="0.42" />
      <path
        d="M0 510 C150 470 245 535 365 505 C500 470 575 525 690 495 C820 460 940 520 1100 480 L1100 610 C945 650 820 590 690 625 C555 660 480 590 365 635 C240 680 125 600 0 650Z"
        fill="#9FD5E0"
        fillOpacity="0.72"
        stroke="#6EB7C8"
        strokeWidth="5"
      />
      <path
        d="M0 510 C150 470 245 535 365 505 C500 470 575 525 690 495 C820 460 940 520 1100 480"
        fill="none"
        stroke="#E8FAFC"
        strokeWidth="9"
        strokeOpacity="0.9"
      />
      <g fill="#6C7591" fillOpacity="0.12" stroke="#6C7591" strokeOpacity="0.24" strokeWidth="2">
        {DISTRICTS.map(([name, x, y], index) => (
          <rect key={name} x={x} y={y} width={index % 3 === 0 ? 120 : 105} height={index % 2 === 0 ? 92 : 105} rx="18" />
        ))}
      </g>
      <g fill="#44516B" fillOpacity="0.72" fontSize="15" fontWeight="700" textAnchor="middle">
        {DISTRICTS.map(([name, x, y], index) => (
          <text key={name} x={x + (index % 3 === 0 ? 60 : 52)} y={y + 53}>{name}</text>
        ))}
      </g>
      <Marker x={520} y={530} label="한강">
        <path d="M-9 0h18M0-9v18" stroke="#4B9DB4" strokeWidth="3" />
      </Marker>
      <Marker x={430} y={420} label="서울시청">
        <path d="M-9 7h18L0-9Z" fill="#5E77B8" />
      </Marker>
      <Marker x={575} y={590} label="남산">
        <path d="M-10 7 0-10 10 7Z" fill="#6C9B68" />
      </Marker>
      <g transform="translate(1015 72)" aria-label="방위표">
        <circle r="34" fill="#fff" fillOpacity="0.85" stroke="#C5CFD6" strokeWidth="2" />
        <path d="M0-26 7 5 0 16-7 5Z" fill="#5E77B8" />
        <path d="M0 26-7-5 0-16 7-5Z" fill="#D3DCE4" />
        <text y="-42" textAnchor="middle" fontSize="16" fontWeight="900" fill="#28324A">N</text>
      </g>
      <g transform="translate(35 850)">
        <rect width="190" height="34" rx="17" fill="#fff" fillOpacity="0.82" />
        <text x="16" y="22" fontSize="14" fontWeight="700" fill="#44516B">서울 25개 자치구 · 한강</text>
      </g>
    </g>
  )
}
