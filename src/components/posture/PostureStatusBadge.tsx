import { POSTURE_COPY, QUALITY_COPY } from '@/constants/copy'
import { Badge } from '@/components/ui'
import type { DetectionQuality, PostureState } from '@/types'

/**
 * 자세 상태 표시.
 * 색만으로 상태를 전달하지 않고 아이콘·텍스트를 항상 함께 씁니다. (docs/12 §12)
 */
export function PostureStatusBadge({
  state,
  quality,
}: {
  state: PostureState
  quality?: DetectionQuality
}) {
  const copy = POSTURE_COPY[state]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={copy.tone}>
        <span aria-hidden="true">{copy.icon}</span>
        {copy.label}
      </Badge>
      {quality && quality !== 'good' && (
        <Badge tone="muted">{QUALITY_COPY[quality]}</Badge>
      )}
    </div>
  )
}

export function PostureMessage({ state }: { state: PostureState }) {
  return (
    <p aria-live="polite" className="text-xl font-bold text-ink">
      {POSTURE_COPY[state].message}
    </p>
  )
}
