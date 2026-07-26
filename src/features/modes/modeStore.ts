import { create } from 'zustand'
import { loadLocal, saveLocal } from '@/lib/storage/local'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { useUserStore } from '@/features/onboarding/userStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import type { LearningProfileKind } from '@/types'

/**
 * 학습 모드 — 기본 3종(도서관·내 공간·팀플) + 내 모드(최대 3개).
 *
 * 모드는 소리 기본값·연출 강도·스트레칭 추천·친구 기능·괴물 테마만 바꿉니다.
 * 자세 판정 임계값은 모드와 무관하며, 모드를 바꿔도 XP·기록·성장은 유지됩니다.
 */
export type MonsterThemeId = 'bookmong' | 'neulmong' | 'komong'

export const MONSTER_THEMES: Record<
  MonsterThemeId,
  { name: string; tagline: string }
> = {
  bookmong: { name: '책더미 괴물 북몽이', tagline: '쌓여가는 읽을거리' },
  neulmong: { name: '늘어짐 괴물 늘몽이', tagline: '스르르 무너지는 자세' },
  komong: { name: '팀플 괴물 꼬몽이', tagline: '끝나지 않는 회의' },
}

export type AmbientLevel = 'low' | 'default' | 'rich'
export type StretchPref = 'seated' | 'mixed' | 'full'
export type SoundPackId = 'silent' | 'soft' | 'social'

export const SOUND_PACK_LABEL: Record<SoundPackId, string> = {
  silent: '무음',
  soft: '부드러운 알림',
  social: '협동 알림',
}
export const AMBIENT_LABEL: Record<AmbientLevel, string> = {
  low: '작게',
  default: '기본',
  rich: '풍부하게',
}
export const STRETCH_LABEL: Record<StretchPref, string> = {
  seated: '앉아서',
  mixed: '혼합',
  full: '전신',
}

export interface CustomMode {
  id: string
  name: string
  emoji: string
  focusMin: number
  restMin: number
  soundPack: SoundPackId
  ambient: AmbientLevel
  stretch: StretchPref
  friendFeatures: boolean
  /** 연결한 자세 기준 (calibrationStore 프로필 id). null = 세션 전 선택 */
  calibrationProfileId: string | null
  monsterTheme: MonsterThemeId
}

/** 화면·세션이 소비하는 정규화된 모드 설정 */
export interface ActiveModeConfig {
  id: string
  kind: LearningProfileKind
  name: string
  emoji: string
  soundPack: SoundPackId
  ambient: AmbientLevel
  stretch: StretchPref
  friendFeatures: boolean
  monsterTheme: MonsterThemeId
  calibrationProfileId: string | null
  /** 내 모드의 기본 시간 (기본 모드는 null → 세션 설정값 사용) */
  focusMin: number | null
  restMin: number | null
}

const BUILTIN_CONFIG: Record<
  'library' | 'home' | 'team',
  Omit<ActiveModeConfig, 'id' | 'kind' | 'name' | 'emoji' | 'calibrationProfileId'>
> = {
  library: {
    soundPack: 'silent',
    ambient: 'low',
    stretch: 'seated',
    friendFeatures: false,
    monsterTheme: 'bookmong',
    focusMin: null,
    restMin: null,
  },
  home: {
    soundPack: 'soft',
    ambient: 'rich',
    stretch: 'full',
    friendFeatures: false,
    monsterTheme: 'neulmong',
    focusMin: null,
    restMin: null,
  },
  team: {
    soundPack: 'social',
    ambient: 'default',
    stretch: 'mixed',
    friendFeatures: true,
    monsterTheme: 'komong',
    focusMin: null,
    restMin: null,
  },
}

export const MAX_CUSTOM_MODES = 3

const BUILTIN_NAMES = LEARNING_PROFILES.map((p) => p.name)

/** 내 모드 이름 검증 — 통과하면 null, 아니면 사용자 안내 문구 */
export function validateCustomModeName(
  name: string,
  existing: CustomMode[],
  selfId?: string,
): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 12) {
    return '이름은 2~12자로 입력해 주세요.'
  }
  const taken =
    BUILTIN_NAMES.includes(trimmed) ||
    existing.some((m) => m.id !== selfId && m.name === trimmed)
  return taken ? '같은 이름의 모드가 이미 있어요.' : null
}

interface PersistShape {
  activeModeId: string
  customModes: CustomMode[]
  /** 기본 모드에 연결한 자세 기준 (모드 id → 프로필 id) */
  builtinCalibration: Partial<Record<'library' | 'home' | 'team', string>>
}

interface ModeStoreState extends PersistShape {
  setActiveMode: (id: string) => void
  /** 성공 시 생성된 id, 실패(3개 초과) 시 null */
  createCustomMode: (mode: Omit<CustomMode, 'id'>) => string | null
  updateCustomMode: (id: string, patch: Partial<Omit<CustomMode, 'id'>>) => void
  deleteCustomMode: (id: string) => void
  linkCalibration: (modeId: string, profileId: string | null) => void
  reset: () => void
}

const KEY = 'modes'

const initial: PersistShape = {
  activeModeId: 'library',
  customModes: [],
  builtinCalibration: {},
}

export type StoredCustomMode = Omit<CustomMode, 'soundPack' | 'friendFeatures'> & {
  soundPack?: SoundPackId
  friendFeatures?: boolean
  /** 구버전 필드 — soft/silent 로 이관 */
  soundEnabled?: boolean
}

export function migrateCustomMode(m: StoredCustomMode): CustomMode {
  const { soundEnabled, ...rest } = m
  return {
    ...rest,
    soundPack: m.soundPack ?? (soundEnabled ? 'soft' : 'silent'),
    friendFeatures: m.friendFeatures ?? true,
  }
}

const persistedRaw = loadLocal<
  Omit<PersistShape, 'customModes'> & { customModes?: StoredCustomMode[] }
>(KEY, initial)
const persisted: PersistShape = {
  ...initial,
  ...persistedRaw,
  customModes: (persistedRaw.customModes ?? []).map(migrateCustomMode),
}

function persist(s: PersistShape): void {
  saveLocal(KEY, s)
}

function snap(s: ModeStoreState): PersistShape {
  return {
    activeModeId: s.activeModeId,
    customModes: s.customModes,
    builtinCalibration: s.builtinCalibration,
  }
}

export const useModeStore = create<ModeStoreState>((set, get) => ({
  ...initial,
  ...persisted,

  setActiveMode: (id) => {
    const s = get()
    const isBuiltin = id === 'library' || id === 'home' || id === 'team'
    const custom = s.customModes.find((m) => m.id === id)
    if (!isBuiltin && !custom) return

    // 레거시 소비자(스트레칭 추천·소리 기본값)를 위해 userStore.profileId 동기화.
    // 모드 변경은 XP·기록·성장에 손대지 않습니다.
    useUserStore
      .getState()
      .setProfile((isBuiltin ? id : 'custom') as LearningProfileKind)

    const next = { ...snap(s), activeModeId: id }
    persist(next)
    set({ activeModeId: id })

    const config = resolveModeConfig(id, {
      customModes: s.customModes,
      builtinCalibration: s.builtinCalibration,
    })
    // 내 모드: 저장한 집중·휴식 시간을 세션 설정 기본값으로 반영.
    // 기본 3모드는 현재 선택된 세션 시간을 그대로 둡니다.
    if (config.kind === 'custom' && config.focusMin !== null) {
      useSessionStore.getState().configure({
        lengthId: 'custom',
        customFocusMin: config.focusMin,
        customRestMin: config.restMin ?? 5,
      })
    }
    // 연결된 자세 기준이 실제로 존재할 때만 활성화합니다.
    // 없거나 삭제된 id 면 기존 활성 기준을 임의로 바꾸지 않습니다(사용자 선택).
    if (config.calibrationProfileId) {
      const cal = useCalibrationStore.getState()
      if (cal.profiles.some((p) => p.id === config.calibrationProfileId)) {
        cal.selectProfile(config.calibrationProfileId)
      }
    }
  },

  createCustomMode: (mode) => {
    const s = get()
    if (s.customModes.length >= MAX_CUSTOM_MODES) return null
    if (validateCustomModeName(mode.name, s.customModes) !== null) return null
    const id = `custom-${Date.now()}`
    const customModes = [...s.customModes, { ...mode, name: mode.name.trim(), id }]
    persist({ ...snap(s), customModes })
    set({ customModes })
    return id
  },

  updateCustomMode: (id, patch) => {
    const s = get()
    const safePatch = { ...patch }
    if (
      safePatch.name !== undefined &&
      validateCustomModeName(safePatch.name, s.customModes, id) !== null
    ) {
      delete safePatch.name
    }
    if (safePatch.name !== undefined) safePatch.name = safePatch.name.trim()
    const customModes = s.customModes.map((m) =>
      m.id === id ? { ...m, ...safePatch, id } : m,
    )
    persist({ ...snap(s), customModes })
    set({ customModes })
  },

  deleteCustomMode: (id) => {
    const s = get()
    const customModes = s.customModes.filter((m) => m.id !== id)
    const activeModeId = s.activeModeId === id ? 'library' : s.activeModeId
    if (activeModeId !== s.activeModeId) {
      useUserStore.getState().setProfile('library')
    }
    persist({ ...snap(s), customModes, activeModeId })
    set({ customModes, activeModeId })
  },

  linkCalibration: (modeId, profileId) => {
    const s = get()
    if (modeId === 'library' || modeId === 'home' || modeId === 'team') {
      const builtinCalibration = {
        ...s.builtinCalibration,
        [modeId]: profileId ?? undefined,
      }
      persist({ ...snap(s), builtinCalibration })
      set({ builtinCalibration })
    } else {
      get().updateCustomMode(modeId, { calibrationProfileId: profileId })
    }
  },

  reset: () => {
    persist(initial)
    set({ ...initial })
  },
}))

/** 현재 활성 모드의 정규화 설정 */
export function getActiveModeConfig(): ActiveModeConfig {
  const s = useModeStore.getState()
  return resolveModeConfig(s.activeModeId, s)
}

export function resolveModeConfig(
  id: string,
  s: Pick<PersistShape, 'customModes' | 'builtinCalibration'> = useModeStore.getState(),
): ActiveModeConfig {
  if (id === 'library' || id === 'home' || id === 'team') {
    const base = LEARNING_PROFILES.find((p) => p.id === id)
    return {
      id,
      kind: id,
      name: base?.name ?? id,
      emoji: id === 'library' ? '📚' : id === 'home' ? '🏠' : '🤝',
      calibrationProfileId: s.builtinCalibration[id] ?? null,
      ...BUILTIN_CONFIG[id],
    }
  }
  const custom = s.customModes.find((m) => m.id === id)
  if (!custom) return resolveModeConfig('library', s)
  return {
    id: custom.id,
    kind: 'custom',
    name: custom.name,
    emoji: custom.emoji,
    soundPack: custom.soundPack,
    ambient: custom.ambient,
    stretch: custom.stretch,
    friendFeatures: custom.friendFeatures,
    monsterTheme: custom.monsterTheme,
    calibrationProfileId: custom.calibrationProfileId,
    focusMin: custom.focusMin,
    restMin: custom.restMin,
  }
}

/** React 구독용 */
export function useActiveModeConfig(): ActiveModeConfig {
  const activeModeId = useModeStore((s) => s.activeModeId)
  const customModes = useModeStore((s) => s.customModes)
  const builtinCalibration = useModeStore((s) => s.builtinCalibration)
  return resolveModeConfig(activeModeId, { customModes, builtinCalibration })
}

/** 단일 진입점 별칭 — 화면·세션이 소비하는 유효 모드 설정 */
export const useEffectiveModeConfig = useActiveModeConfig
export const getEffectiveModeConfig = getActiveModeConfig
