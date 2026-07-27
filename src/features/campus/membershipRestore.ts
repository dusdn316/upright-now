import { useCampusThemeStore } from './campusThemeStore'
import { useCampusDirectoryStore } from './schoolDirectory'
import type { CampusRepository } from './repository'

/**
 * 다른 기기·localStorage 초기화 후 복원(§7):
 * 서버 membership 이 권위입니다. 로컬 선택이 비었거나 서버와 다르면
 * 서버 학교를 채택하고, 커스텀 학교면 디렉터리에서 이름·색을 복원합니다.
 * (변경 이력·쿨다운을 소모하지 않는 복원 전용 경로)
 */
export async function restoreMembershipFromServer(
  repository: CampusRepository,
): Promise<void> {
  try {
    const membership = await repository.fetchMyMembership?.()
    if (!membership?.schoolId) return

    const theme = useCampusThemeStore.getState()
    if (theme.schoolId === membership.schoolId) return

    const entry = useCampusDirectoryStore.getState().entries[membership.schoolId]
    theme.adoptServerSchool(membership.schoolId, entry ?? null)
  } catch {
    /* 복원 실패는 조용히 — 다음 initCampus 에서 다시 시도합니다 */
  }
}
