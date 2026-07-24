import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { GrowthTimeline } from '@/components/character/GrowthTimeline'
import { Badge, Button, Card } from '@/components/ui'
import { FRIEND_ROOM, PREPARING_NOTICE } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { useProgressionStore } from '@/features/progression/progressionStore'

/**
 * 아직 디자인·상호작용을 구현하지 않은 화면.
 * 실제로 동작하지 않는 기능을 "완료"처럼 보이게 하지 않습니다. (AGENTS.md §6)
 * 사용자 화면에는 개발 단계나 일정 표현을 쓰지 않습니다.
 */
export function Placeholder({
  title,
  description,
  notice = PREPARING_NOTICE,
}: {
  title: string
  description: string
  notice?: string
}) {
  const navigate = useNavigate()

  return (
    <AppShell>
      <PageHeader title={title} description={description} />
      <Card tone="canvas">
        <div className="flex flex-col items-start gap-3">
          <Badge tone="muted">준비 중</Badge>
          <p className="text-sm text-ink-soft">{notice}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate(ROUTES.home)}>
              대시보드로
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(ROUTES.sessionSetup)}
            >
              집중 세션 시작
            </Button>
          </div>
        </div>
      </Card>
    </AppShell>
  )
}

export const Shop = () => (
  <Placeholder
    title="상점"
    description="모은 잎사귀로 대학 컬러 과잠과 캠퍼스 백팩을 고를 수 있어요."
  />
)

export const RoomNew = () => (
  <Placeholder
    title="친구 방 만들기"
    description="친구에게는 닉네임, 진행 상태, 게임 이벤트만 보여요. 카메라와 개인 자세 상태는 공유하지 않아요."
    notice={FRIEND_ROOM.toast}
  />
)

export const Room = () => (
  <Placeholder
    title="친구 방 대기실"
    description="6자리 코드로 최대 2명이 함께 25분을 진행하는 공간이에요."
    notice={FRIEND_ROOM.toast}
  />
)

export const Settings = () => (
  <Placeholder
    title="설정"
    description="닉네임, 카메라, 소리, 민감도, 장소 기준, 데이터 초기화를 관리할 화면이에요."
  />
)

export function Growth() {
  const xp = useProgressionStore((s) => s.xp)
  return (
    <AppShell>
      <PageHeader
        title="성장"
        description="바른 자세로 회복할 때마다 쌓인 경험치로 6단계 캐릭터가 성장해요."
      />
      <Card tone="blue">
        <GrowthTimeline xp={xp} />
      </Card>
    </AppShell>
  )
}
