import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '@/app/App'
import { useGameStore } from '@/features/game/gameStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { DEMO_PROGRESSION, useDemoStore } from '@/features/demo/demoMode'
import { resetRewardsForTest } from '@/features/game/rewards'
import { BOSS_MAX_HP, DAMAGE, REWARD } from '@/constants/game'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function resetAll() {
  useGameStore.getState().reset()
  usePostureStore.getState().reset()
  useDemoStore.getState().disableDemo()
  // disableDemo 는 이제 "데모 진입 전 상태 복원"이라, 테스트 격리를 위해
  // 사용자·성장 스토어를 명시적으로 초기화합니다.
  useProgressionStore.getState().reset()
  useUserStore.getState().reset()
  resetRewardsForTest()
}

describe('QA Lab mock 상태 → 게임 반응 (Phase 1 핵심 흐름)', () => {
  beforeEach(resetAll)

  // 파일의 첫 테스트가 App 전체 transform 비용을 떠안아 느린 환경에서
  // 기본 5초를 살짝 넘길 수 있습니다. (단언 실패가 아니라 셋업 시간 문제)
  it('상태를 주입하면 자세 문구와 캐릭터 상태가 함께 바뀐다', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    renderAt('/lab')

    await user.click(screen.getByRole('button', { name: /bad · 회복 기회/ }))
    expect(
      screen.getByText('처음 등록한 기준으로 가볍게 돌아와 볼까요?'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /away · 자리 비움/ }))
    expect(
      screen.getByText('잠시 자리를 비웠어요. 돌아오면 측정을 이어갈게요.'),
    ).toBeInTheDocument()
  })

  it('recovery success → 보스 체력 감소 · 콤보 증가 · XP 증가 · 토스트', async () => {
    const user = userEvent.setup()
    renderAt('/lab')

    await user.click(screen.getByRole('button', { name: 'recovery success' }))

    // 보스 체력 (네이티브 <progress> 의 value)
    const bossBar = screen.getByRole('progressbar', { name: /마감괴수/ })
    expect(bossBar).toHaveAttribute(
      'value',
      String(Math.round(((BOSS_MAX_HP - DAMAGE.recovery) / BOSS_MAX_HP) * 100)),
    )

    // 콤보·XP
    expect(useGameStore.getState().combo).toBe(1)
    expect(useProgressionStore.getState().xp).toBe(
      DEMO_PROGRESSION.xp + REWARD.recovery.xp,
    )

    // 성공 토스트
    expect(screen.getByText('자세를 회복했어요! 회복 에너지 발사!')).toBeInTheDocument()

    // 회복 후에는 편안한 기준 문구로 돌아온다
    expect(screen.getByText('편안한 기준에 가까워요.')).toBeInTheDocument()
  })

  it('자세가 나빠져도 성장 단계는 내려가지 않는다 (AGENTS.md §2.5)', async () => {
    const user = userEvent.setup()
    renderAt('/lab')

    // "성장 단계" 통계 타일만 정확히 집습니다. (QA 패널의 Lv 버튼과 구분)
    const stageTile = screen.getByText('성장 단계').parentElement as HTMLElement
    expect(stageTile).toHaveTextContent('Lv.3')

    await user.click(screen.getByRole('button', { name: /bad · 회복 기회/ }))
    await user.click(screen.getByRole('button', { name: /away · 자리 비움/ }))

    expect(stageTile).toHaveTextContent('Lv.3')
    expect(useProgressionStore.getState().xp).toBe(DEMO_PROGRESSION.xp)
  })
})

describe('대시보드', () => {
  beforeEach(() => {
    resetAll()
    useUserStore.setState({ hasOnboarded: true, nickname: '수현' })
  })

  it('기본 세션 길이는 25분이다', () => {
    renderAt('/')

    const picker = screen.getByRole('group', { name: '세션 길이 선택' })
    const selected = within(picker).getByRole('radio', { checked: true })

    expect(selected).toHaveAccessibleName(/25분 집중/)
  })

  it('실제 사용자는 Lv.1 뽀각 거북에서 시작한다', () => {
    renderAt('/')

    expect(useProgressionStore.getState().xp).toBe(0)
    expect(screen.getAllByText(/Lv\.1 뽀각 거북/).length).toBeGreaterThan(0)
  })

  it('데모가 아니면 데모 배지와 데모 닉네임을 보여주지 않는다', () => {
    renderAt('/')

    expect(screen.queryByText('데모')).not.toBeInTheDocument()
    expect(screen.queryByText('데모 기린')).not.toBeInTheDocument()
  })

  it('데모 모드에서만 데모 종료 버튼을 보여준다', () => {
    useDemoStore.getState().enableDemo()
    renderAt('/')

    expect(screen.getByText('데모 종료')).toBeInTheDocument()
  })
})
