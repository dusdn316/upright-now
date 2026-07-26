import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { ROUTES } from '@/constants/routes'
import { clampCustomFocusMin, clampCustomRestMin } from '@/constants/session'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import {
  AMBIENT_LABEL,
  MAX_CUSTOM_MODES,
  MONSTER_THEMES,
  SOUND_PACK_LABEL,
  STRETCH_LABEL,
  useModeStore,
  validateCustomModeName,
  type AmbientLevel,
  type CustomMode,
  type MonsterThemeId,
  type SoundPackId,
  type StretchPref,
} from '@/features/modes/modeStore'

const TONE: Record<string, 'pink' | 'yellow' | 'blue' | 'green'> = {
  library: 'blue',
  home: 'pink',
  team: 'yellow',
}

type Draft = Omit<CustomMode, 'id'>

const DEFAULT_DRAFT: Draft = {
  name: '',
  emoji: '🌙',
  focusMin: 25,
  restMin: 5,
  soundPack: 'silent',
  ambient: 'default',
  stretch: 'mixed',
  calibrationProfileId: null,
  monsterTheme: 'neulmong',
  friendFeatures: false,
}

/** S-03 학습 프로필 — 기본 3모드 + 내 모드(최대 3개, 전체 필드 편집) */
export function Profiles() {
  const navigate = useNavigate()
  const activeModeId = useModeStore((s) => s.activeModeId)
  const customModes = useModeStore((s) => s.customModes)
  const setActiveMode = useModeStore((s) => s.setActiveMode)
  const createCustomMode = useModeStore((s) => s.createCustomMode)
  const updateCustomMode = useModeStore((s) => s.updateCustomMode)
  const deleteCustomMode = useModeStore((s) => s.deleteCustomMode)
  const calProfiles = useCalibrationStore((s) => s.profiles)

  /** null=닫힘, 'new'=생성, 그 외=편집 중인 모드 id */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [error, setError] = useState<string | null>(null)

  const openCreate = () => {
    setDraft(DEFAULT_DRAFT)
    setError(null)
    setEditingId('new')
  }

  const openEdit = (mode: CustomMode) => {
    const { id: _id, ...rest } = mode
    setDraft(rest)
    setError(null)
    setEditingId(mode.id)
  }

  const save = () => {
    const selfId = editingId === 'new' ? undefined : (editingId ?? undefined)
    const nameError = validateCustomModeName(draft.name, customModes, selfId)
    if (nameError) {
      setError(nameError)
      return
    }
    const clean: Draft = {
      ...draft,
      name: draft.name.trim(),
      emoji: draft.emoji || '🌙',
      focusMin: clampCustomFocusMin(draft.focusMin),
      restMin: clampCustomRestMin(draft.restMin),
      // 삭제된 기준 id 는 저장하지 않습니다.
      calibrationProfileId:
        draft.calibrationProfileId &&
        calProfiles.some((p) => p.id === draft.calibrationProfileId)
          ? draft.calibrationProfileId
          : null,
    }
    if (editingId === 'new') {
      const id = createCustomMode(clean)
      if (!id) {
        setError('모드를 만들 수 없어요. 이름과 개수를 확인해 주세요.')
        return
      }
    } else if (editingId) {
      updateCustomMode(editingId, clean)
    }
    setEditingId(null)
    setError(null)
  }

  const field = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

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
                    '괴물',
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
          <div className="flex items-center gap-2">
            <Badge tone="blue">{`${customModes.length} / ${MAX_CUSTOM_MODES}`}</Badge>
            {customModes.length < MAX_CUSTOM_MODES && editingId === null && (
              <Button size="sm" onClick={openCreate}>
                새 모드 만들기
              </Button>
            )}
          </div>
        </div>

        {customModes.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {customModes.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm"
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
                <span className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  {`${m.focusMin}분·휴식 ${m.restMin}분 · ${SOUND_PACK_LABEL[m.soundPack]} · ${STRETCH_LABEL[m.stretch]} · ${MONSTER_THEMES[m.monsterTheme].name}`}
                  <Button size="sm" variant="secondary" onClick={() => openEdit(m)}>
                    편집
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCustomMode(m.id)}>
                    삭제
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {editingId !== null && (
          <div className="mt-4 rounded-2xl border border-line bg-canvas p-4">
            <p className="text-sm font-bold text-ink">
              {editingId === 'new' ? '새 내 모드' : '내 모드 편집'}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">이름 (2~12자)</span>
                <input
                  maxLength={12}
                  value={draft.name}
                  onChange={(e) => field('name', e.target.value)}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">이모지</span>
                <input
                  maxLength={2}
                  value={draft.emoji}
                  onChange={(e) => field('emoji', e.target.value)}
                  className="h-9 w-16 rounded-xl border border-line bg-surface px-2 text-center text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">기본 집중 (5~120분)</span>
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  value={draft.focusMin}
                  onChange={(e) => field('focusMin', Number(e.target.value))}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">기본 회복 휴식 (0~30분)</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={5}
                  value={draft.restMin}
                  onChange={(e) => field('restMin', Number(e.target.value))}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">소리 팩</span>
                <select
                  value={draft.soundPack}
                  onChange={(e) => field('soundPack', e.target.value as SoundPackId)}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                >
                  <option value="silent">무음</option>
                  <option value="soft">부드러운 알림</option>
                  <option value="social">협동 알림</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">화면 연출</span>
                <select
                  value={draft.ambient}
                  onChange={(e) => field('ambient', e.target.value as AmbientLevel)}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                >
                  <option value="low">{AMBIENT_LABEL.low}</option>
                  <option value="default">{AMBIENT_LABEL.default}</option>
                  <option value="rich">{AMBIENT_LABEL.rich}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">스트레칭</span>
                <select
                  value={draft.stretch}
                  onChange={(e) => field('stretch', e.target.value as StretchPref)}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                >
                  <option value="seated">{STRETCH_LABEL.seated}</option>
                  <option value="mixed">{STRETCH_LABEL.mixed}</option>
                  <option value="full">{STRETCH_LABEL.full}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">연결 자세 기준</span>
                <select
                  value={draft.calibrationProfileId ?? ''}
                  onChange={(e) =>
                    field('calibrationProfileId', e.target.value || null)
                  }
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                >
                  <option value="">연결 안 함 (세션 전 선택)</option>
                  {calProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-ink-soft">괴물</span>
                <select
                  value={draft.monsterTheme}
                  onChange={(e) => field('monsterTheme', e.target.value as MonsterThemeId)}
                  className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
                >
                  <option value="bookmong">북몽이</option>
                  <option value="neulmong">늘몽이</option>
                  <option value="komong">꼬몽이</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                <input
                  type="checkbox"
                  checked={draft.friendFeatures}
                  onChange={(e) => field('friendFeatures', e.target.checked)}
                />
                친구 기능 사용
              </label>
            </div>

            {error && <p className="mt-2 text-xs font-bold text-coral">{error}</p>}

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={save}>
                저장
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                취소
              </Button>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-ink-soft">
          내 모드는 최대 3개까지예요. 모드를 바꿔도 XP·기록·성장은 그대로예요.
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
