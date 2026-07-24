import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { ROUTES } from '@/constants/routes'
import { useUserStore } from '@/features/onboarding/userStore'

const TONE: Record<string, 'pink' | 'yellow' | 'blue' | 'green'> = {
  library: 'blue',
  home: 'pink',
  team: 'yellow',
}

/** S-03 학습 프로필 — docs/05, docs/13 §4 */
export function Profiles() {
  const navigate = useNavigate()
  const { profileId, setProfile } = useUserStore()

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="오늘은 어디에서 공부하나요?"
        description="장소마다 소리·화면 효과·스트레칭 추천이 달라져요. 나중에 설정에서 바꿀 수 있어요."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {LEARNING_PROFILES.map((profile) => {
          const selected = profile.id === profileId
          return (
            <Card
              key={profile.id}
              tone={TONE[profile.id]}
              className={selected ? 'ring-2 ring-pink' : ''}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* 카드마다 최소한의 시각 차이 — 새 이미지 파일 없이 Icon 만 사용 */}
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-ink">
                    <Icon name={profile.icon} size={22} />
                  </span>
                  <h2 className="text-lg font-bold text-ink">{profile.name}</h2>
                </div>
                {selected && <Badge tone="pink">선택됨</Badge>}
              </div>
              <p className="mt-2 min-h-[42px] text-sm text-ink-soft">
                {profile.description}
              </p>

              <dl className="mt-4 flex flex-col gap-1.5 text-xs">
                {[
                  ['소리', profile.sound],
                  ['화면 효과', profile.ambient],
                  ['스트레칭', profile.stretchKind],
                  ['장소 기준', '등록 전'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-ink-soft">{label}</dt>
                    <dd className="font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <Button
                fullWidth
                className="mt-5"
                variant={selected ? 'primary' : 'secondary'}
                onClick={() => setProfile(profile.id)}
              >
                {selected ? '이 모드로 진행' : '이 모드 선택'}
              </Button>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4 border-dashed">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink">내 모드</h2>
            <p className="mt-1 text-sm text-ink-soft">
              직접 만드는 학습 모드는 다음 단계에서 열려요.
            </p>
          </div>
          <Badge tone="muted">P1</Badge>
        </div>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate(ROUTES.home)}>
          나중에 하기
        </Button>
        <Button size="lg" onClick={() => navigate(ROUTES.camera)}>
          다음 · 카메라 안내
        </Button>
      </div>
    </AppShell>
  )
}
