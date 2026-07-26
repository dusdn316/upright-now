import type { CampusContributionEvent, CampusSnapshot } from './types'
import type { ContributionRejectReason } from './contribution'

/**
 * 캠퍼스 저장소 경계.
 *
 * 화면과 스토어는 이 인터페이스만 사용합니다.
 * mock(로컬) → Supabase 로 바꿀 때 화면 코드를 고치지 않아도 되도록,
 * 스냅샷 모양과 메서드 시그니처를 저장소 종류와 무관하게 고정합니다.
 */
export interface CampusSubmitResult {
  accepted: boolean
  points: number
  reason?: ContributionRejectReason | 'not_ready'
  captured?: boolean
  contested?: boolean
  tileId?: string
}

export interface CampusRepository {
  readonly kind: 'mock' | 'supabase'
  /** 현재 시즌 스냅샷 */
  load(): Promise<CampusSnapshot>
  /**
   * 실시간 반영. 같은 브라우저의 다른 탭 또는 다른 클라이언트의 변경을
   * 즉시 전달합니다. 해제 함수를 돌려줍니다.
   */
  subscribe(listener: (snapshot: CampusSnapshot) => void): () => void
  /** 원자적 기여 반영 + 타일 점령 판정 */
  submitContribution(event: CampusContributionEvent): Promise<CampusSubmitResult>
  dispose(): void
}
