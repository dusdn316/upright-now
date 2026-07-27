import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_CUSTOM_MODES,
  MONSTER_THEMES,
  resolveModeConfig,
  useModeStore,
  migrateCustomMode,
} from './modeStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { makeProfile } from '@/features/posture-engine/testFixtures'
import { clampCustomFocusMin, clampCustomRestMin } from '@/constants/session'

const draft = {
  name: '새벽 공부',
  emoji: '🌙',
  focusMin: 50,
  restMin: 10,
  soundPack: 'silent' as const,
  ambient: 'low' as const,
  stretch: 'seated' as const,
  calibrationProfileId: null,
  monsterTheme: 'neulmong' as const,
  friendFeatures: false,
}

describe('modeStore — 내 모드 CRUD', () => {
  beforeEach(() => {
    useModeStore.getState().reset()
  })

  it('생성·수정·삭제가 동작한다', () => {
    const id = useModeStore.getState().createCustomMode(draft)
    expect(id).not.toBeNull()
    expect(useModeStore.getState().customModes).toHaveLength(1)

    useModeStore.getState().updateCustomMode(id!, { name: '아침 공부' })
    expect(useModeStore.getState().customModes[0].name).toBe('아침 공부')

    useModeStore.getState().deleteCustomMode(id!)
    expect(useModeStore.getState().customModes).toHaveLength(0)
  })

  it('최대 3개까지만 만들 수 있다', () => {
    const s = useModeStore.getState()
    for (let i = 0; i < MAX_CUSTOM_MODES; i += 1) {
      expect(s.createCustomMode({ ...draft, name: `모드${i}` })).not.toBeNull()
    }
    expect(useModeStore.getState().createCustomMode(draft)).toBeNull()
    expect(useModeStore.getState().customModes).toHaveLength(MAX_CUSTOM_MODES)
  })

  it('선택 중인 내 모드를 삭제하면 도서관 모드로 돌아간다', () => {
    const id = useModeStore.getState().createCustomMode(draft)!
    useModeStore.getState().setActiveMode(id)
    useModeStore.getState().deleteCustomMode(id)
    expect(useModeStore.getState().activeModeId).toBe('library')
  })
})

describe('modeStore — 모드 변경은 XP·기록을 건드리지 않는다', () => {
  beforeEach(() => {
    useModeStore.getState().reset()
  })

  it('setActiveMode 전후 XP 가 같다', () => {
    useProgressionStore.setState({ xp: 777 })
    useModeStore.getState().setActiveMode('team')
    expect(useProgressionStore.getState().xp).toBe(777)

    const id = useModeStore.getState().createCustomMode(draft)!
    useModeStore.getState().setActiveMode(id)
    expect(useProgressionStore.getState().xp).toBe(777)
  })
})

describe('modeStore — 괴물 테마 매핑', () => {
  it('기본 모드 3종의 괴물이 스펙과 일치한다', () => {
    expect(resolveModeConfig('library').monsterTheme).toBe('bookmong')
    expect(resolveModeConfig('home').monsterTheme).toBe('neulmong')
    expect(resolveModeConfig('team').monsterTheme).toBe('komong')
    expect(MONSTER_THEMES.bookmong.name).toContain('북몽이')
    expect(MONSTER_THEMES.neulmong.name).toContain('늘몽이')
    expect(MONSTER_THEMES.komong.name).toContain('꼬몽이')
  })

  it('없는 모드 id 는 도서관 설정으로 폴백한다', () => {
    expect(resolveModeConfig('ghost').monsterTheme).toBe('bookmong')
  })
})

describe('사용자 지정 세션 길이 클램프', () => {
  it('집중 시간은 5~120분, 5분 단위', () => {
    expect(clampCustomFocusMin(3)).toBe(5)
    expect(clampCustomFocusMin(47)).toBe(45)
    expect(clampCustomFocusMin(999)).toBe(120)
  })

  it('회복 휴식은 0~30분', () => {
    expect(clampCustomRestMin(-5)).toBe(0)
    expect(clampCustomRestMin(12)).toBe(10)
    expect(clampCustomRestMin(90)).toBe(30)
  })
})

describe('modeStore v2 — 전체 필드·검증·연결', () => {
  beforeEach(() => {
    useModeStore.getState().reset()
    useCalibrationStore.getState().clear()
  })

  it('모든 필드가 저장·편집된다', () => {
    const id = useModeStore.getState().createCustomMode({
      ...draft,
      soundPack: 'social',
      ambient: 'rich',
      stretch: 'full',
      friendFeatures: true,
    })!
    const saved = useModeStore.getState().customModes[0]
    expect(saved.soundPack).toBe('social')
    expect(saved.ambient).toBe('rich')
    expect(saved.stretch).toBe('full')
    expect(saved.friendFeatures).toBe(true)

    useModeStore.getState().updateCustomMode(id, { soundPack: 'soft', focusMin: 90 })
    const updated = useModeStore.getState().customModes[0]
    expect(updated.soundPack).toBe('soft')
    expect(updated.focusMin).toBe(90)
  })

  it('빈 이름·1자·중복 이름은 만들 수 없다', () => {
    const s = useModeStore.getState()
    expect(s.createCustomMode({ ...draft, name: '' })).toBeNull()
    expect(s.createCustomMode({ ...draft, name: '밤' })).toBeNull()
    expect(s.createCustomMode({ ...draft, name: '새벽 공부' })).not.toBeNull()
    expect(useModeStore.getState().createCustomMode({ ...draft, name: '새벽 공부' })).toBeNull()
    // 기본 모드와 같은 이름도 금지
    expect(useModeStore.getState().createCustomMode({ ...draft, name: '도서관' })).toBeNull()
  })

  it('구버전 soundEnabled 저장값이 soundPack 으로 이관된다', () => {
    const legacyOn = migrateCustomMode({ ...draft, id: 'c1', soundPack: undefined, friendFeatures: undefined, soundEnabled: true } as never)
    const legacyOff = migrateCustomMode({ ...draft, id: 'c2', soundPack: undefined, friendFeatures: undefined, soundEnabled: false } as never)
    expect(legacyOn.soundPack).toBe('soft')
    expect(legacyOff.soundPack).toBe('silent')
    expect(legacyOn.friendFeatures).toBe(true)
  })

  it('내 모드를 선택하면 저장한 집중·휴식 시간이 세션 설정에 반영된다', () => {
    const id = useModeStore.getState().createCustomMode({ ...draft, focusMin: 50, restMin: 10 })!
    useModeStore.getState().setActiveMode(id)
    const session = useSessionStore.getState()
    expect(session.lengthId).toBe('custom')
    expect(Math.round(session.plannedMs / 60000)).toBe(50)
  })

  it('기본 모드 선택은 현재 세션 시간을 바꾸지 않는다', () => {
    useSessionStore.getState().configure({ lengthId: '15' })
    useModeStore.getState().setActiveMode('team')
    expect(useSessionStore.getState().lengthId).toBe('15')
  })

  it('연결된 유효 자세 기준이 있으면 모드 선택 시 활성화된다', () => {
    const p = { ...makeProfile(), id: 'cal-linked' }
    useCalibrationStore.getState().addProfile(p)
    useCalibrationStore.getState().addProfile({ ...makeProfile(), id: 'cal-other' })
    const id = useModeStore.getState().createCustomMode({ ...draft, calibrationProfileId: 'cal-linked' })!
    useModeStore.getState().setActiveMode(id)
    expect(useCalibrationStore.getState().activeProfileId).toBe('cal-linked')
  })

  it('삭제된 기준 id 는 자동 적용하지 않고 기존 활성 기준을 유지한다', () => {
    useCalibrationStore.getState().addProfile({ ...makeProfile(), id: 'cal-keep' })
    const id = useModeStore.getState().createCustomMode({ ...draft, calibrationProfileId: 'cal-deleted' })!
    useModeStore.getState().setActiveMode(id)
    expect(useCalibrationStore.getState().activeProfileId).toBe('cal-keep')
  })

  it('기본 3모드의 sound pack·연출·스트레칭이 스펙과 일치한다', () => {
    expect(resolveModeConfig('library')).toMatchObject({ soundPack: 'silent', ambient: 'low', stretch: 'seated', friendFeatures: false })
    expect(resolveModeConfig('home')).toMatchObject({ soundPack: 'soft', ambient: 'rich', stretch: 'full', friendFeatures: false })
    expect(resolveModeConfig('team')).toMatchObject({ soundPack: 'social', ambient: 'default', stretch: 'mixed', friendFeatures: true })
  })
})
