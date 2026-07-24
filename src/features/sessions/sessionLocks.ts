/**
 * 세션 id 단위 잠금 해제 콜백 레지스트리.
 * sessionStore ↔ finalizeSession/rewards 간 import 순환을 피하기 위한 작은 다리입니다.
 */
type Release = (sessionId: string) => void

const releases: Release[] = []

export function registerSessionLockRelease(fn: Release): void {
  if (!releases.includes(fn)) releases.push(fn)
}

export function releaseSessionLocks(sessionId: string): void {
  for (const fn of releases) fn(sessionId)
}
