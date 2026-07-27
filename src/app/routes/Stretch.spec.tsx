import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/rooms/roomService', () => ({
  reportStretchComplete: vi.fn(() => Promise.resolve()),
}))

import { Stretch } from './Stretch'
import { ToastProvider } from '@/app/providers/ToastProvider'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { resetRewardsForTest } from '@/features/game/rewards'
import { useRoomStore } from '@/features/rooms/roomStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { reportStretchComplete } from '@/features/rooms/roomService'

function renderStretch() {
  return render(
    <MemoryRouter initialEntries={['/stretch/demo']}>
      <ToastProvider>
        <Stretch />
      </ToastProvider>
    </MemoryRouter>,
  )
}

/** 타이머를 0초까지 진행시킵니다. (동작 길이는 30~45초) */
function runTimerToZero() {
  for (let i = 0; i < 60; i += 1) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    if (screen.queryByText('완료하고 돌아가기')) return
  }
}

describe('스트레칭 완주 보상 — 타이머 0초 + 직접 완료 클릭에만 지급', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetRewardsForTest()
    useProgressionStore.setState({ xp: 0, points: 0 })
    useRoomStore.getState().reset()
    useSessionStore.getState().reset()
    vi.mocked(reportStretchComplete).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('타이머가 0초가 되기 전에는 완료 버튼이 없다', () => {
    renderStretch()

    expect(screen.queryByText('완료하고 돌아가기')).toBeNull()
    expect(screen.queryByText('완료')).toBeNull()
    // 완료 전에는 잠시 멈춤·다시 시작·다른 동작·그만하고 돌아가기만 있습니다.
    expect(screen.getByText('잠시 멈춤')).toBeInTheDocument()
    expect(screen.getByText('다시 시작')).toBeInTheDocument()
    expect(screen.getByText('다른 동작')).toBeInTheDocument()
    expect(screen.getByText('그만하고 돌아가기')).toBeInTheDocument()
  })

  it('10초 진행 후 중간 종료하면 보상이 없다', () => {
    renderStretch()

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    fireEvent.click(screen.getByText('그만하고 돌아가기'))

    expect(useProgressionStore.getState().xp).toBe(0)
    expect(useProgressionStore.getState().points).toBe(0)
  })

  it('0초 도달 후 완료하고 돌아가기를 누르면 +10 XP / +10P 정확히 1회', () => {
    renderStretch()

    runTimerToZero()
    fireEvent.click(screen.getByText('완료하고 돌아가기'))

    expect(useProgressionStore.getState().xp).toBe(10)
    expect(useProgressionStore.getState().points).toBe(10)
  })

  it('대기실(waiting) 방에서는 공동 방어막을 올리지 않는다', () => {
    useRoomStore.getState().patch({ roomId: 'room-1', phase: 'waiting' })
    renderStretch()

    runTimerToZero()
    fireEvent.click(screen.getByText('완료하고 돌아가기'))

    expect(useProgressionStore.getState().xp).toBe(10)
    expect(reportStretchComplete).not.toHaveBeenCalled()
  })

  it('진행 중(running) 방에서 완주하면 방어막 반영을 정확히 1회 요청한다', () => {
    // isRoomSessionActive 4중 검사 — 방 id·phase·mode·세션 id 를 모두 맞춥니다.
    useRoomStore.getState().patch({ roomId: 'room-1', phase: 'running', code: 'AB12CD' })
    useSessionStore.getState().configure({ mode: 'room' })
    useSessionStore.getState().start('room-AB12CD')
    renderStretch()

    runTimerToZero()
    fireEvent.click(screen.getByText('완료하고 돌아가기'))

    expect(reportStretchComplete).toHaveBeenCalledTimes(1)
  })
})
