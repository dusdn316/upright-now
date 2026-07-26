import type { CampusTile, CampusZoneId } from './types'

/**
 * 가상 캠퍼스 섬 — 12×8 타일 모델 위의 표현 계층입니다.
 * 실제 학교·지역 지도를 복제하지 않은 자체 제작 배치이며,
 * 36개 territory 는 기존 타일 좌표(x,y)에 1:1 매핑되어
 * 점령·경합·기여 로직과 저장 데이터가 그대로 이어집니다.
 * (square 지도 데이터 migration = 동일 tileId 재사용)
 */
export interface IslandShape {
  x: number
  y: number
  zone: CampusZoneId
  name: string
  /** SVG polygon points (viewBox 0 0 120 84) */
  points: string
  cx: number
  cy: number
}

/** 결정적 의사 난수 — 렌더마다 흔들리지 않게 인덱스 기반 */
function jitter(seed: number, k: number): number {
  const v = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453
  return (v - Math.floor(v)) * 4 - 2 // -2..2
}

function blob(seed: number, cx: number, cy: number, r: number): string {
  const pts: string[] = []
  const corners = 6 + (seed % 3)
  for (let i = 0; i < corners; i += 1) {
    const angle = (Math.PI * 2 * i) / corners
    const rad = r + jitter(seed, i)
    const px = cx + Math.cos(angle) * rad * 1.15
    const py = cy + Math.sin(angle) * rad * 0.85
    pts.push(px.toFixed(1) + ',' + py.toFixed(1))
  }
  return pts.join(' ')
}

interface Spot {
  x: number
  y: number
  zone: CampusZoneId
  name: string
}

/** 섬 배치 — 중앙광장을 심장으로 8개 구역 36 territory */
const SPOTS: Spot[] = [
  // 중앙광장 (plaza)
  { x: 5, y: 3, zone: 'plaza', name: '중앙광장 분수' },
  { x: 6, y: 3, zone: 'plaza', name: '중앙광장 시계탑' },
  { x: 5, y: 4, zone: 'plaza', name: '중앙광장 벤치숲' },
  { x: 6, y: 4, zone: 'plaza', name: '중앙광장 게시판' },
  // 도서관 (library)
  { x: 3, y: 1, zone: 'library', name: '중앙도서관 본관' },
  { x: 4, y: 1, zone: 'library', name: '도서관 열람실' },
  { x: 3, y: 2, zone: 'library', name: '고서 서고' },
  { x: 4, y: 2, zone: 'library', name: '미디어 자료실' },
  // 강의동 (lecture)
  { x: 7, y: 1, zone: 'lecture', name: '제1강의동' },
  { x: 8, y: 1, zone: 'lecture', name: '제2강의동' },
  { x: 9, y: 1, zone: 'lecture', name: '공학관' },
  { x: 7, y: 2, zone: 'lecture', name: '인문관' },
  { x: 8, y: 2, zone: 'lecture', name: '자연과학관' },
  { x: 9, y: 2, zone: 'lecture', name: '대형 강의실' },
  // 잔디광장 (lawn)
  { x: 2, y: 4, zone: 'lawn', name: '동편 잔디광장' },
  { x: 3, y: 4, zone: 'lawn', name: '피크닉 잔디' },
  { x: 2, y: 5, zone: 'lawn', name: '버스킹 잔디' },
  { x: 3, y: 5, zone: 'lawn', name: '낮잠 언덕' },
  // 카페거리 (cafe)
  { x: 7, y: 4, zone: 'cafe', name: '카페거리 입구' },
  { x: 8, y: 4, zone: 'cafe', name: '골목 카페' },
  { x: 9, y: 4, zone: 'cafe', name: '디저트 가게' },
  { x: 8, y: 5, zone: 'cafe', name: '심야 카페' },
  // 기숙사 (dorm)
  { x: 1, y: 1, zone: 'dorm', name: '해오름 기숙사' },
  { x: 1, y: 2, zone: 'dorm', name: '달빛 기숙사' },
  { x: 1, y: 3, zone: 'dorm', name: '기숙사 라운지' },
  { x: 2, y: 2, zone: 'dorm', name: '기숙사 식당' },
  // 운동장 (field)
  { x: 5, y: 6, zone: 'field', name: '대운동장' },
  { x: 6, y: 6, zone: 'field', name: '농구 코트' },
  { x: 7, y: 6, zone: 'field', name: '풋살장' },
  { x: 6, y: 5, zone: 'field', name: '트랙 관중석' },
  // 산책로·연못 (pond)
  { x: 10, y: 3, zone: 'pond', name: '거북 연못' },
  { x: 10, y: 4, zone: 'pond', name: '수양버들 산책로' },
  { x: 10, y: 5, zone: 'pond', name: '징검다리' },
  { x: 9, y: 6, zone: 'pond', name: '연못 정자' },
  { x: 4, y: 5, zone: 'lawn', name: '벚꽃길' },
  { x: 4, y: 6, zone: 'field', name: '체육관 앞마당' },
]

export const ISLAND_SHAPES: IslandShape[] = SPOTS.map((spot, i) => {
  const cx = spot.x * 9.5 + 7 + jitter(i, 11)
  const cy = spot.y * 9.5 + 6 + jitter(i, 23)
  return {
    ...spot,
    cx,
    cy,
    points: blob(i + 1, cx, cy, 4.6),
  }
})

/** 타일 좌표 → 섬 territory (표시 계층 매핑) */
export function shapeFor(tile: Pick<CampusTile, 'x' | 'y'>): IslandShape | null {
  return ISLAND_SHAPES.find((s) => s.x === tile.x && s.y === tile.y) ?? null
}
