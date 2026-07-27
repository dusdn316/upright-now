import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampusCaptureLog } from './CampusPanels'
import type { CampusTile, CampusTileEvent } from '@/features/campus/types'

/**
 * "최근 점령 로그" 는 점령·경합만 보여 줍니다.
 * 방어 보강(reinforced)이 점령 기록을 밀어내 보이지 않게 하는 것을 막습니다.
 */
const TILE: CampusTile = {
  id: 'season-1:3-3',
  seasonId: 'season-1',
  x: 3,
  y: 3,
  zone: 'library',
  name: '테스트 도서관',
  ownerSchoolId: 'snu',
  challengerSchoolId: null,
  defenseScore: 240,
  challengeScore: 0,
  updatedAt: 0,
}

function event(kind: CampusTileEvent['kind'], id: string, at: number): CampusTileEvent {
  return {
    id,
    seasonId: 'season-1',
    tileId: TILE.id,
    kind,
    fromSchoolId: null,
    toSchoolId: 'snu',
    at,
  }
}

const EVENTS: CampusTileEvent[] = [
  event('reinforced', 'r1', 5000),
  event('reinforced', 'r2', 4000),
  event('reinforced', 'r3', 3000),
  event('captured', 'c1', 2000),
  event('contested', 'x1', 1000),
]

describe('캠퍼스 영토 변화 로그', () => {
  it('kinds 를 주면 그 종류만 보여준다', () => {
    render(
      <CampusCaptureLog
        events={EVENTS}
        tiles={[TILE]}
        limit={2}
        kinds={['captured', 'contested']}
      />,
    )

    const rows = screen.getAllByTestId('campus-log-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('점령')
    expect(rows[1]).toHaveTextContent('경합 시작')
    expect(screen.queryByText(/방어 보강/)).not.toBeInTheDocument()
  })

  it('kinds 가 없으면 방어 보강까지 모두 보여준다', () => {
    render(<CampusCaptureLog events={EVENTS} tiles={[TILE]} limit={10} />)

    expect(screen.getAllByTestId('campus-log-row')).toHaveLength(5)
    expect(screen.getAllByText(/방어 보강/).length).toBe(3)
  })

  it('걸러낸 결과가 없으면 안내 문구를 보여준다', () => {
    render(
      <CampusCaptureLog
        events={[event('reinforced', 'r1', 1)]}
        tiles={[TILE]}
        kinds={['captured']}
        emptyDescription="아직 점령이나 경합이 없어요."
      />,
    )

    expect(screen.getByText('아직 영토 변화가 없어요')).toBeInTheDocument()
    expect(screen.getByText('아직 점령이나 경합이 없어요.')).toBeInTheDocument()
  })
})
