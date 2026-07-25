import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_CUSTOM_MODES,
  MONSTER_THEMES,
  resolveModeConfig,
  useModeStore,
} from './modeStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { clampCustomFocusMin, clampCustomRestMin } from '@/constants/session'

const draft = {
  name: '새벽 공부',
  emoji: '🌙',
  focusMin: 50,
  restMin: 10,
  soundEnabled: false,
  ambient: 'low' as const,
  stretch: 'seated' as const,
  calibrationProfileId: null,
  monsterTheme: 'neulmong' as const,
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
