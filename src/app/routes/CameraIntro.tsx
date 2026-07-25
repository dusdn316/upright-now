import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CAMERA_DEMO_NOTICE, PRIVACY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useDemoStore } from '@/features/demo/demoMode'

const STEPS = [
  {
    title: '권한 확인',
    body: '직접 버튼을 누른 뒤에만 브라우저 권한창이 열려요.',
    icon: 'shield',
  },
  {
    title: '5초 기준 맞추기',
    body: '얼굴과 어깨가 보이게 편안히 앉아 주세요.',
    icon: 'camera',
  },
  {
    title: '기기 안에서 분석',
    body: '영상은 저장하지도, 외부로 보내지도 않아요.',
    icon: 'check',
  },
]

/** S-04 카메라 안내 — 권한은 사용자가 CTA를 누른 뒤에만 요청합니다. */
export function CameraIntro() {
  const navigate = useNavigate()
  const configure = useSessionStore((s) => s.configure)

  const startDemo = () => {
    useDemoStore.getState().enableDemo()
    configure({ lengthId: 'demo' })
    navigate(ROUTES.sessionSetup)
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="자세를 살펴볼 수 있게 카메라를 연결해 주세요"
        description="카메라는 자세 변화만 이 기기 안에서 살펴봐요. 영상과 사진은 저장하거나 외부로 보내지 않아요."
        back={ROUTES.profiles}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Card key={step.title} tone={index === 2 ? 'green' : 'surface'}>
            <div className="flex items-center gap-2 text-ink">
              <Icon name={step.icon} />
              <h2 className="text-base font-bold">{`${index + 1}. ${step.title}`}</h2>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{step.body}</p>
          </Card>
        ))}
      </div>

      <Card tone="green" className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRIVACY.badges.map((badge) => (
            <Badge key={badge} tone="green">
              <Icon name="shield" size={14} />
              {badge}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-soft">{PRIVACY.medical}</p>
      </Card>

      {!featureFlags.camera && (
        <Card tone="yellow" className="mt-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon name="play" size={16} />
            {CAMERA_DEMO_NOTICE}
          </p>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {featureFlags.camera ? (
          <>
            <Button size="lg" variant="secondary" onClick={startDemo}>
              카메라 없이 3분 데모
            </Button>
            <Button size="lg" onClick={() => navigate(ROUTES.calibration)}>
              <Icon name="camera" size={18} />
              카메라 연결하기
            </Button>
          </>
        ) : (
          // 카메라 기능이 꺼져 있으면 데모가 주 CTA 입니다.
          <Button size="lg" onClick={startDemo}>
            <Icon name="play" size={18} />
            카메라 없이 3분 데모
          </Button>
        )}
      </div>
    </AppShell>
  )
}
