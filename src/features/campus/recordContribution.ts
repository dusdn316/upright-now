import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useDemoStore } from '@/features/demo/demoMode'
import {
  evaluateContribution,
  normalizeLedger,
  type ContributionLedger,
  type ContributionRejectReason,
} from './contribution'
import { getCampusMemberId } from './identity'
import { useCampusThemeStore } from './campusThemeStore'
import { getCampusRepository, initCampus, useCampusStore } from './campusStore'
import { pickTargetTile } from './territory'
import type { CampusContributionKind } from './types'

/**
 * 기여 이벤트 기록 — 유일한 진입점.
 *
 * 여기로 들어오는 값은 "성공했다는 사실"뿐입니다.
 * 자세 점수·좌표·`bad` 상태·카메라 데이터는 인자로 받지도, 저장하지도 않습니다.
 *
 * 거절되는 경우: 플래그 OFF · 데모 · QA · 학교 미선택 · eventId/sessionId 중복 ·
 * 하루 상한 · 세션당 회복 상한 · 과도한 이벤트.
 */
export type ContributionSkipReason =
  | ContributionRejectReason
  | 'disabled'
  | 'demo_or_qa'
  | 'no_school'
  | 'not_ready'

export interface RecordResult {
  accepted: boolean
  points: number
  reason?: ContributionSkipReason
  tileId?: string
  captured?: boolean
}

let ledger: ContributionLedger | null = null

function readLedger(): ContributionLedger {
  if (!ledger) {
    ledger = normalizeLedger(loadLocal<unknown>(STORAGE_KEYS.campusLedger, null))
  }
  return ledger
}

function writeLedger(next: ContributionLedger): void {
  ledger = next
  saveLocal(STORAGE_KEYS.campusLedger, next)
}

/** 테스트 전용 */
export function resetContributionLedgerForTest(): void {
  ledger = null
}

export interface RecordInput {
  kind: CampusContributionKind
  /** 중복 차단 키. 같은 성공에 대해 항상 같은 값이어야 합니다. */
  eventId: string
  sessionId: string | null
  at?: number
  /** 데모·QA 여부를 호출부가 알고 있으면 넘깁니다. */
  isDemo?: boolean
}

export async function recordCampusContribution(
  input: RecordInput,
): Promise<RecordResult> {
  if (!featureFlags.campusTerritory) return { accepted: false, points: 0, reason: 'disabled' }

  // 데모·QA 세션은 기여도가 없습니다.
  const isDemo = input.isDemo ?? useDemoStore.getState().isDemo
  if (isDemo) return { accepted: false, points: 0, reason: 'demo_or_qa' }

  const schoolId = useCampusThemeStore.getState().schoolId
  if (!schoolId) return { accepted: false, points: 0, reason: 'no_school' }

  const at = input.at ?? Date.now()

  const previous = readLedger()
  const decision = evaluateContribution(previous, {
    eventId: input.eventId,
    kind: input.kind,
    sessionId: input.sessionId,
    at,
  })
  if (!decision.accepted) {
    // 거절된 경우에도 rate-limit 창 정리는 반영합니다.
    writeLedger(decision.ledger)
    return { accepted: false, points: 0, reason: decision.reason }
  }

  /*
    원장은 await 전에 동기적으로 확정합니다.
    두 이벤트가 거의 동시에 들어와도 같은 원장을 두 번 읽어 상한을 우회하지
    못하게 하는 것이 목적입니다. 저장소가 준비되지 않아 실제 반영에 실패하면
    아래에서 되돌립니다.
  */
  writeLedger(decision.ledger)

  /** 우리가 쓴 원장이 그대로 남아 있을 때만 되돌립니다. (다른 호출 덮어쓰기 방지) */
  const rollback = () => {
    if (ledger === decision.ledger) writeLedger(previous)
  }

  if (!getCampusRepository()) await initCampus()
  const repository = getCampusRepository()
  const snapshot = useCampusStore.getState().snapshot
  if (!repository || !snapshot) {
    rollback()
    return { accepted: false, points: 0, reason: 'not_ready' }
  }

  const target = pickTargetTile(
    snapshot.tiles,
    schoolId,
    useCampusThemeStore.getState().targetTileId,
  )
  if (!target) {
    rollback()
    return { accepted: false, points: 0, reason: 'not_ready' }
  }

  const result = await repository.submitContribution({
    eventId: input.eventId,
    kind: input.kind,
    seasonId: snapshot.season.id,
    schoolId,
    memberId: getCampusMemberId(),
    sessionId: input.sessionId,
    tileId: target.id,
    points: decision.points,
    occurredAt: at,
  })

  // 저장소가 아직 준비되지 않아 거절된 경우에만 되돌립니다.
  // 중복(duplicate_*)은 이미 반영된 것이므로 원장을 유지합니다.
  if (!result.accepted && result.reason === 'not_ready') rollback()

  return {
    accepted: result.accepted,
    points: result.points,
    reason: result.accepted ? undefined : (result.reason as ContributionSkipReason),
    tileId: result.tileId,
    captured: result.captured,
  }
}
