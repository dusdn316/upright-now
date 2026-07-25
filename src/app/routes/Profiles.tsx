import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { ROUTES } from '@/constants/routes'
import {
  MAX_CUSTOM_MODES,
  MONSTER_THEMES,
  useModeStore,
  type MonsterThemeId,
} from '@/features/modes/modeStore'

const TONE: Record<string, 'pink' | 'yellow' | 'blue' | 'green'> = {
  library: 'blue',
  home: 'pink',
  team: 'yellow',
}

/** S-03 학습 프로필 — 기본 3모드 + 내 모드(최대 3개). 모드 변경은 XP·기록에 영향 없음 */
export function Profiles() {
  const navigate = useNavigate()
  const activeModeId = useModeStore((s) => s.activeModeId)
  const customModes = useModeStore((s) => s.customModes)
  const setActiveMode = useModeStore((s) => s.setActiveMode)
  const createCustomMode = useModeStore((s) => s.createCustomMode)
  const deleteCustomMode = useModeStore((s) => s.deleteCustomMode)
  const [draftName, setDraftName] = useState('')
  const [draftEmoji, setDraftEmoji] = useState('🌙')
  const [draftMonster, setDraftMonster] = useState<MonsterThemeId>('neulmong')

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="오늘은 어디에서 공부하나요?"
        description="장소마다 소리·화면 효과·스트레칭 추천이 달라져요. 모드를 바꿔도 XP·기록·성장은 그대로예요."
        back={ROUTES.onboardingName}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {LEARNING_PROFILES.map((profile) => {
          const selected = profile.id === activeModeId
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
                  [
                    '마감 괴물',
                    MONSTER_THEMES[
                      profile.id === 'library'
                        ? 'bookmong'
                        : profile.id === 'team'
                          ? 'komong'
                          : 'neulmong'
                    ].name,
                  ],
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
                onClick={() => setActiveMode(profile.id)}
              >
                {selected ? '이 모드로 진행' : '이 모드 선택'}
              </Button>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-ink">내 모드</h2>
          <Badge tone="blue">{`${customModes.length} / ${MAX_CUSTOM_MODES}`}</Badge>
        </div>

        {customModes.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {customModes.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  className="flex items-center gap-2 font-bold text-ink"
                  onClick={() => setActiveMode(m.id)}
                >
                  <span aria-hidden="true">{m.emoji}</span>
                  {m.name}
                  {activeModeId === m.id && <Badge tone="pink">선택됨</Badge>}
                </button>
                <span className="flex items-center gap-2 text-xs text-ink-soft">
                  {MONSTER_THEMES[m.monsterTheme].name}
                  <Button size="sm" variant="ghost" onClick={() => deleteCustomMode(m.id)}>
                    삭제
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {customModes.length < MAX_CUSTOM_MODES ? (
          <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-soft">이름 (12자)</span>
              <input
                maxLength={12}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-9 w-32 rounded-xl border border-line bg-surface px-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-soft">이모지</span>
              <input
                maxLength={2}
                value={draftEmoji}
                onChange={(e) => setDraftEmoji(e.target.value)}
                className="h-9 w-14 rounded-xl border border-line bg-surface px-2 text-center"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-soft">괴물 테마</span>
              <select
                value={draftMonster}
                onChange={(e) => setDraftMonster(e.target.value as MonsterThemeId)}
                className="h-9 rounded-xl border border-line bg-surface px-2"
              >
                <option value="bookmong">북몽이</option>
                <option value="neulmong">늘몽이</option>
                <option value="komong">꼬몽이</option>
              </select>
            </label>
            <Button
              size="sm"
              disabled={!draftName.trim()}
              onClick={() => {
                createCustomMode({
                  name: draftName.trim().slice(0, 12),
                  emoji: draftEmoji || '🌙',
                  focusMin: 25,
                  restMin: 5,
                  soundEnabled: false,
                  ambient: 'default',
                  stretch: 'mixed',
                  calibrationProfileId: null,
                  monsterTheme: draftMonster,
                })
                setDraftName('')
              }}
            >
              만들기
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-soft">
            내 모드는 최대 3개까지예요. 새로 만들려면 기존 모드를 삭제해 주세요.
          </p>
        )}
        <p className="mt-2 text-xs text-ink-soft">
          시간·소리·스트레칭·자세 기준 연결은 세션 설정 화면에서 조정할 수 있어요.
        </p>
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
