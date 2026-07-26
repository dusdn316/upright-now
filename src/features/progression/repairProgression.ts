import { useProgressionStore } from './progressionStore'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { selectSessionStats } from '@/features/sessions/todayFocus'

/**
 * 완료 세션 기록은 있는데 상점이 잠겨 있거나 완료 수가 뒤처진 계정을
 * 앱 시작 시 자동 복구합니다. 값을 깎는 방향으로는 절대 동작하지 않습니다.
 */
export function repairProgressionFromHistory(): void {
  const stats = selectSessionStats(useSessionHistoryStore.getState().summaries)
  if (stats.completedCount === 0) return
  const p = useProgressionStore.getState()
  const patch: Partial<{ shopUnlocked: boolean; completedSessions: number }> = {}
  if (!p.shopUnlocked) patch.shopUnlocked = true
  if (p.completedSessions < stats.completedCount) {
    patch.completedSessions = stats.completedCount
  }
  if (Object.keys(patch).length > 0) useProgressionStore.setState(patch)
}
