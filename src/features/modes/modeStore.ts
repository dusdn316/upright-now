import { create } from 'zustand'
import { loadLocal, saveLocal } from '@/lib/storage/local'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { useUserStore } from '@/features/onboarding/userStore'
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

export interface CustomMode {
  id: string
  name: string
  emoji: string
  focusMin: number
  restMin: number
  soundEnabled: boolean
  ambient: AmbientLevel
  stretch: StretchPref
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
  soundDefault: boolean
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
    soundDefault: false,
    ambient: 'low',
    stretch: 'seated',
    friendFeatures: false,
    monsterTheme: 'bookmong',
    focusMin: null,
    restMin: null,
  },
  home: {
    soundDefault: true,
    ambient: 'rich',
    stretch: 'full',
    friendFeatures: false,
    monsterTheme: 'neulmong',
    focusMin: null,
    restMin: null,
  },
  team: {
    soundDefault: true,
    ambient: 'default',
    stretch: 'mixed',
    friendFeatures: true,
    monsterTheme: 'komong',
    focusMin: null,
    restMin: null,
  },
}

export const MAX_CUSTOM_MODES = 3

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

const persisted = loadLocal<PersistShape>(KEY, initial)

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
  },

  createCustomMode: (mode) => {
    const s = get()
    if (s.customModes.length >= MAX_CUSTOM_MODES) return null
    const id = `custom-${Date.now()}`
    const customModes = [...s.customModes, { ...mode, id }]
    persist({ ...snap(s), customModes })
    set({ customModes })
    return id
  },

  updateCustomMode: (id, patch) => {
    const s = get()
    const customModes = s.customModes.map((m) =>
      m.id === id ? { ...m, ...patch, id } : m,
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
    soundDefault: custom.soundEnabled,
    ambient: custom.ambient,
    stretch: custom.stretch,
    friendFeatures: true,
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
