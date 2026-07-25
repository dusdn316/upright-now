import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * VITE_ENABLE_QA_LAB=false (운영 빌드 기본값) 상황.
 * /lab 라우트와 세션 화면의 QA 패널이 모두 사라져야 합니다. (docs/02 FR-017)
 */
const OFF = {
  camera: false,
  friendRoom: false,
  realtimeRoom: false,
  pictureInPicture: false,
  qaLab: false,
  optionalSlouchCalibration: false,
}

vi.mock('@/lib/feature-flags/flags', () => ({
  featureFlags: OFF,
  parseFlag: () => false,
  readFeatureFlags: () => OFF,
}))

const { App } = await import('@/app/App')
const { useGameStore } = await import('@/features/game/gameStore')
const { usePostureStore } = await import('@/features/posture-engine/postureStore')
const { useDemoStore } = await import('@/features/demo/demoMode')

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('QA Lab 숨김', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    usePostureStore.getState().reset()
    useDemoStore.getState().disableDemo()
  })

  it('/lab 은 라우트가 없고 홈으로 되돌아간다', () => {
    renderAt('/lab')

    expect(screen.queryByText('QA Lab · 상태 주입')).not.toBeInTheDocument()
    expect(
      screen.getByText('오늘의 목표, 편안한 자세로 시작해 볼까요?'),
    ).toBeInTheDocument()
  })

  it('사이드바에 QA Lab 링크가 없다', () => {
    renderAt('/')

    expect(screen.queryByRole('link', { name: 'QA Lab' })).not.toBeInTheDocument()
  })

  it('집중 세션 화면에도 QA 패널이 없다', () => {
    renderAt('/session/demo')

    expect(screen.queryByText('QA Lab · 상태 주입')).not.toBeInTheDocument()
    // 기본(도서관) 모드의 마감 괴물이 표시된다
    expect(screen.getByText('책더미 괴물 북몽이')).toBeInTheDocument()
  })
})
