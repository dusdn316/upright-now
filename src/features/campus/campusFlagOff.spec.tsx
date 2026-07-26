import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * 캠퍼스 플래그가 모두 꺼진 기본 빌드.
 *
 * 기존 앱이 완전히 그대로 동작하고, 캠퍼스 메뉴·화면·기여 기록이
 * 어디에서도 나타나지 않아야 합니다.
 */
const OFF = {
  camera: false,
  friendRoom: false,
  realtimeRoom: false,
  pictureInPicture: false,
  qaLab: false,
  optionalSlouchCalibration: false,
  campusTheme: false,
  campusTerritory: false,
  campusSchoolPicker: false,
}

vi.mock('@/lib/feature-flags/flags', () => ({
  featureFlags: OFF,
  parseFlag: () => false,
  readFeatureFlags: () => OFF,
}))

const { App } = await import('@/app/App')
const { recordCampusContribution } = await import('./recordContribution')
const { useCampusStore } = await import('./campusStore')
const { useCampusThemeStore } = await import('./campusThemeStore')
const { useDemoStore } = await import('@/features/demo/demoMode')

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('캠퍼스 플래그 OFF', () => {
  beforeEach(() => {
    localStorage.clear()
    useCampusThemeStore.getState().reset()
    useDemoStore.setState({ isDemo: false })
  })

  it('사이드바에 캠퍼스 메뉴가 없다', () => {
    renderAt('/')
    expect(screen.queryByRole('link', { name: '캠퍼스' })).not.toBeInTheDocument()
  })

  it('대시보드에 캠퍼스 카드가 없다', () => {
    renderAt('/')
    expect(screen.queryByTestId('campus-dashboard-card')).not.toBeInTheDocument()
  })

  it('/campus 주소는 라우트가 없고 홈으로 되돌아간다', () => {
    renderAt('/campus')
    expect(screen.queryByTestId('territory-map')).not.toBeInTheDocument()
    expect(
      screen.getByText('오늘의 목표, 편안한 자세로 시작해 볼까요?'),
    ).toBeInTheDocument()
  })

  it('/campus/map 과 /campus/history 도 홈으로 되돌아간다', () => {
    for (const path of ['/campus/map', '/campus/history']) {
      const view = renderAt(path)
      expect(screen.queryByTestId('territory-map')).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('설정 화면에 학교 선택이 없다', () => {
    renderAt('/settings')
    expect(screen.queryByText('학교 선택 (캠퍼스 테마)')).not.toBeInTheDocument()
    expect(screen.queryByTestId('campus-unofficial-line')).not.toBeInTheDocument()
    // 기존 설정 항목은 그대로 있습니다.
    expect(screen.getAllByText('감지 민감도').length).toBeGreaterThan(0)
  })

  it('결과 화면에 캠퍼스 공유 테두리·학교 배지가 없다', () => {
    // 코어의 결과 화면 가드(세션 id 검증)를 통과하려면 데모 모드가 필요합니다.
    useDemoStore.setState({ isDemo: true })
    renderAt('/result/demo')
    expect(screen.queryByTestId('campus-share-frame')).not.toBeInTheDocument()
    expect(screen.queryByTestId('campus-school-badge')).not.toBeInTheDocument()
    expect(screen.getByText('이번에 얻은 보상')).toBeInTheDocument()
  })

  it('기여 기록 호출은 즉시 무시되고 저장소를 만들지 않는다', async () => {
    const result = await recordCampusContribution({
      kind: 'session_completed',
      eventId: 'off-1',
      sessionId: 's1',
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('disabled')
    expect(useCampusStore.getState().status).toBe('idle')
    expect(useCampusStore.getState().snapshot).toBeNull()
  })

  it('캠퍼스 CSS 변수가 문서에 주입되지 않는다', () => {
    useCampusThemeStore.getState().selectSchool('snu')
    renderAt('/')
    expect(
      document.documentElement.style.getPropertyValue('--campus-primary'),
    ).toBe('')
    expect(document.documentElement.getAttribute('data-campus-school')).toBeNull()
  })
})
