import { useEffect } from 'react'
import { useToast } from '@/app/providers/ToastProvider'
import { useCampusFeedbackStore } from '@/features/campus/campusFeedback'

/**
 * 캠퍼스 기여 피드백 → 토스트 연결부. UI 를 직접 그리지 않습니다.
 * (recordCampusContribution 은 React 밖에서 실행되므로 버스를 경유합니다)
 */
export function CampusFeedbackToaster() {
  const { push } = useToast()
  const queue = useCampusFeedbackStore((s) => s.queue)
  const drain = useCampusFeedbackStore((s) => s.drain)

  useEffect(() => {
    if (queue.length === 0) return
    for (const item of drain()) {
      push({ tone: item.tone, title: item.title, description: item.description })
    }
  }, [queue, drain, push])

  return null
}
