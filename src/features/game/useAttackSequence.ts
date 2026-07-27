import { useEffect, useRef, useState } from 'react'

/**
 * 회복 공격 연출 시퀀스 — 메인 세션 3.2초.
 * 0.0~0.7s 캐릭터 회복·충전 → 0.7~1.4s 에너지 이동 →
 * 1.4~2.5s 괴물 피격(흔들림·피해·HP) → 2.5~3.2s 콤보·보상 표시.
 * 타이머·자세 판정은 계속되고, 조작을 막지 않습니다(모달 아님).
 * HP 수치는 store 가 즉시 반영하고, 여기서는 '피격 연출 시점'만 지연합니다.
 */
export const ATTACK_TOTAL_MS = 3200
export const ATTACK_HIT_AT_MS = 1400
export const ATTACK_REWARD_AT_MS = 2500
export const PIP_ATTACK_MS = 1500

export function useAttackSequence(attackTick: number): {
  energyActive: boolean
  bossHitTick: number
  rewardFlash: boolean
} {
  const [energyActive, setEnergyActive] = useState(false)
  const [bossHitTick, setBossHitTick] = useState(0)
  const [rewardFlash, setRewardFlash] = useState(false)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    if (attackTick <= 0) return
    for (const t of timersRef.current) window.clearTimeout(t)
    setEnergyActive(false)
    setRewardFlash(false)
    timersRef.current = [
      window.setTimeout(() => setEnergyActive(true), 700),
      window.setTimeout(() => {
        setEnergyActive(false)
        setBossHitTick((n) => n + 1)
      }, ATTACK_HIT_AT_MS),
      window.setTimeout(() => setRewardFlash(true), ATTACK_REWARD_AT_MS),
      window.setTimeout(() => setRewardFlash(false), ATTACK_TOTAL_MS),
    ]
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t)
    }
  }, [attackTick])

  return { energyActive, bossHitTick, rewardFlash }
}
