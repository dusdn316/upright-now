import type { CampusTile } from './types'

/**
 * 앱 안에서 사용하는 서울 자치구형 지도 좌표입니다.
 * 실제 행정경계 파일을 그대로 복제하지 않고, 서비스의 카드·색상 시스템에
 * 맞춘 단순화 SVG 도형으로 표현합니다. 각 도형은 독립적으로 색칠됩니다.
 */
export interface SeoulDistrict {
  id: string
  name: string
  path: string
  labelX: number
  labelY: number
  centroidX: number
  centroidY: number
}

const d = (
  id: string,
  name: string,
  path: string,
  labelX: number,
  labelY: number,
  centroidX = labelX,
  centroidY = labelY,
): SeoulDistrict => ({ id, name, path, labelX, labelY, centroidX, centroidY })

/** 서울의 동서·남북 흐름을 읽을 수 있게 배치한 25개 자치구 도형. */
export const SEOUL_DISTRICTS: SeoulDistrict[] = [
  d('eunpyeong', '은평구', 'M28 62 72 35 120 48 130 92 106 126 56 120 24 92Z', 73, 83),
  d('seodaemun', '서대문구', 'M130 92 170 70 206 96 196 142 164 160 106 126Z', 155, 116),
  d('mapo', '마포구', 'M24 142 64 120 106 126 164 160 144 202 78 204 30 184Z', 86, 166),
  d('jongno', '종로구', 'M170 70 218 52 260 74 250 118 206 140 196 142Z', 215, 96),
  d('jung', '중구', 'M196 142 206 140 250 118 280 148 258 190 210 190 164 160Z', 222, 163),
  d('yongsan', '용산구', 'M164 160 210 190 258 190 280 224 246 258 184 246 144 202Z', 208, 216),
  d('seongbuk', '성북구', 'M218 52 274 34 320 62 314 110 280 148 250 118 260 74Z', 274, 84),
  d('dongdaemun', '동대문구', 'M314 110 360 88 394 118 384 164 336 174 280 148Z', 337, 137),
  d('gwangjin', '광진구', 'M394 118 442 106 478 138 466 184 414 194 384 164Z', 430, 153),
  d('jungnang', '중랑구', 'M360 58 408 42 454 64 478 106 442 106 394 118 360 88Z', 411, 82),
  d('seongdong', '성동구', 'M280 148 336 174 340 216 304 242 258 190Z', 300, 190),
  d('gangbuk', '강북구', 'M120 18 166 8 218 18 218 52 170 70 130 92 92 62Z', 165, 43),
  d('dobong', '도봉구', 'M166 8 220 2 272 14 274 34 218 52 218 18Z', 221, 20),
  d('nowon', '노원구', 'M272 14 330 6 360 20 360 58 320 62 274 34Z', 315, 31),
  d('gangseo', '강서구', 'M8 224 30 184 78 204 122 238 106 284 54 300 16 278Z', 58, 245),
  d('yangcheon', '양천구', 'M78 204 144 202 184 246 160 286 106 284 122 238Z', 126, 246),
  d('guro', '구로구', 'M16 278 54 300 106 284 160 286 170 334 120 360 64 346 26 324Z', 97, 318),
  d('geumcheon', '금천구', 'M170 334 216 310 258 336 244 388 196 406 154 376Z', 207, 362),
  d('yeongdeungpo', '영등포구', 'M144 202 184 246 246 258 258 298 216 310 160 286Z', 198, 272),
  d('dongjak', '동작구', 'M184 246 246 258 304 242 330 278 286 320 216 310Z', 253, 282),
  d('gwanak', '관악구', 'M216 310 286 320 320 356 286 410 244 388 258 336Z', 278, 359),
  d('seocho', '서초구', 'M304 242 340 216 388 242 414 302 386 350 320 356 286 320 330 278Z', 360, 286),
  d('gangnam', '강남구', 'M388 242 414 194 466 184 500 218 488 274 414 302Z', 447, 246),
  d('songpa', '송파구', 'M466 184 520 174 556 210 548 266 500 274 488 274Z', 510, 222),
  d('gangdong', '강동구', 'M478 106 528 96 574 120 584 174 556 210 520 174 466 184Z', 534, 149),
]

const byId = new Map(SEOUL_DISTRICTS.map((district) => [district.id, district]))

/** 기존 12×8 기록을 새 자치구 도형에 표시하기 위한 호환 매핑입니다. */
export function districtForTile(tile: Pick<CampusTile, 'id' | 'x' | 'y'>): SeoulDistrict {
  const directId = tile.id.split(':').at(-1)
  const direct = directId ? byId.get(directId) : undefined
  if (direct) return direct
  const x = 24 + (tile.x / 11) * 540
  const y = 20 + (tile.y / 7) * 380
  return SEOUL_DISTRICTS.reduce((closest, district) => {
    const currentDistance = Math.hypot(x - district.centroidX, y - district.centroidY)
    const closestDistance = Math.hypot(x - closest.centroidX, y - closest.centroidY)
    return currentDistance < closestDistance ? district : closest
  })
}

export function districtById(id: string): SeoulDistrict | null {
  return byId.get(id) ?? null
}

export interface DistrictTileSummary {
  district: SeoulDistrict
  tiles: CampusTile[]
  representative: CampusTile | null
  ownerSchoolId: string | null
  challengerSchoolId: string | null
  defenseScore: number
  challengeScore: number
}

/** 기존 서버의 타일 점수를 자치구 단위 표시로 합칩니다. */
export function summarizeDistricts(tiles: CampusTile[]): DistrictTileSummary[] {
  const grouped = new Map<string, CampusTile[]>()
  for (const tile of tiles) {
    const district = districtForTile(tile)
    const list = grouped.get(district.id) ?? []
    list.push(tile)
    grouped.set(district.id, list)
  }

  return SEOUL_DISTRICTS.map((district) => {
    const districtTiles = grouped.get(district.id) ?? []
    const ownerScores = new Map<string, number>()
    const challengerScores = new Map<string, number>()
    for (const tile of districtTiles) {
      if (tile.ownerSchoolId) {
        ownerScores.set(tile.ownerSchoolId, (ownerScores.get(tile.ownerSchoolId) ?? 0) + tile.defenseScore)
      }
      if (tile.challengerSchoolId) {
        challengerScores.set(
          tile.challengerSchoolId,
          (challengerScores.get(tile.challengerSchoolId) ?? 0) + tile.challengeScore,
        )
      }
    }
    const maxEntry = (scores: Map<string, number>) =>
      [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    return {
      district,
      tiles: districtTiles,
      representative: districtTiles[0] ?? null,
      ownerSchoolId: maxEntry(ownerScores),
      challengerSchoolId: maxEntry(challengerScores),
      defenseScore: districtTiles.reduce((sum, tile) => sum + tile.defenseScore, 0),
      challengeScore: districtTiles.reduce((sum, tile) => sum + tile.challengeScore, 0),
    }
  })
}
