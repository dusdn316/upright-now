import { useGameStore } from './gameStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { isRoomSessionActive } from '@/features/rooms/roomStore'
import { getActiveModeConfig } from '@/features/modes/modeStore'
import { useMonsterProgress } from './monsterProgress'
import { playSound } from '@/features/sound/soundEngine'

/**
 * 세션 보스 HP ↔ 개인 괴물 장기 진행도 연결.
 * - 개인(비데모·비테스트·비친구방) 세션 시작 시 저장된 괴물 HP 를 로드
 * - 세션 중 입힌 피해를 진행도에 반영, 처치 시 다음 phase 로 진화
 * 친구 방 꼬몽이(방 DB 2000)는 여기서 절대 건드리지 않습니다.
 */
function persistEligible(): boolean {
  const session = useSessionStore.getState()
  return (
    !useDemoStore.getState().isDemo &&
    session.lengthId !== 'test' &&
    session.mode === 'solo' &&
    !isRoomSessionActive()
  )
}

export function installMonsterBridge(): () => void {
  // 세션 시작(idle→running) 시 진행도 로드
  let prevStatus = useSessionStore.getState().status
  const unsubSession = useSessionStore.subscribe((state) => {
    const was = prevStatus
    prevStatus = state.status
    if (was !== 'idle' || state.status !== 'running') return
    if (!persistEligible()) return
    const theme = getActiveModeConfig().monsterTheme
    const boss = useMonsterProgress.getState().getBoss(theme)
    useGameStore.getState().setBoss(boss.hp, boss.maxHp)
  })

  // 피해 반영 — boss.hp 감소분만 진행도에 기록
  let lastHp = useGameStore.getState().boss.hp
  const unsubGame = useGameStore.subscribe((state) => {
    const hp = state.boss.hp
    const prev = lastHp
    lastHp = hp
    if (hp >= prev) return
    if (!persistEligible()) return
    if (useSessionStore.getState().status !== 'running') return
    const theme = getActiveModeConfig().monsterTheme
    const { evolved } = useMonsterProgress
      .getState()
      .applyProgressDamage(theme, prev - hp)
    if (evolved) {
      playSound('monster_evolve')
      const next = useMonsterProgress.getState().getBoss(theme)
      // 다음 단계 괴물로 교체 (lastHp 를 먼저 맞춰 재귀 반영을 막습니다)
      lastHp = next.hp
      useGameStore.getState().setBoss(next.hp, next.maxHp)
    }
  })

  return () => {
    unsubSession()
    unsubGame()
  }
}
