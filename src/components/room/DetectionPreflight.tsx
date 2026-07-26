import { useEffect, useRef, useState } from 'react'
import { useCamera } from '@/features/calibration/useCamera'
import {
  usePoseDetection,
  type PoseFrame,
} from '@/features/posture-engine/usePoseDetection'
import { useRoomStore } from '@/features/rooms/roomStore'

/**
 * 친구 방 입장 전 감지 사전 점검 — 내 기기에서만 수행합니다.
 *
 * 통과 조건: 카메라 권한 + MediaPipe 모델 로드 + "사용 가능한 랜드마크
 * (얼굴 코어+양어깨)"가 1.5초 이상 연속 확인. 통과하면 myCameraReady ·
 * myModelReady 를 켭니다. 영상·좌표는 어디에도 저장·전송하지 않습니다.
 */
const STABLE_MS = 1500

export function DetectionPreflight({
  onDone,
}: {
  onDone: (ok: boolean, message?: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { state: camera, start, stop } = useCamera(videoRef)
  const stableSinceRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const [multiPerson, setMultiPerson] = useState(false)

  useEffect(() => {
    start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { modelStatus } = usePoseDetection(videoRef, {
    enabled: camera.status === 'ready',
    onFrame: (frame: PoseFrame) => {
      if (doneRef.current) return
      setMultiPerson(Boolean(frame.multiPerson))
      const usable =
        !frame.multiPerson &&
        frame.analysis !== null &&
        frame.analysis.faceCoreOk &&
        frame.analysis.bothShouldersOk
      if (!usable) {
        stableSinceRef.current = null
        return
      }
      const now = performance.now()
      stableSinceRef.current ??= now
      if (now - stableSinceRef.current >= STABLE_MS) {
        doneRef.current = true
        useRoomStore.getState().patch({ myCameraReady: true, myModelReady: true })
        onDone(true)
      }
    },
  })

  // 실패 경로: 카메라 거부·모델 로드 실패
  useEffect(() => {
    if (camera.status === 'error') {
      onDone(false, '카메라 권한이 필요해요. 브라우저 설정을 확인해 주세요.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.status])
  useEffect(() => {
    if (modelStatus === 'error') {
      onDone(false, '감지 모델을 불러오지 못했어요. 네트워크를 확인해 주세요.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus])

  return (
    <div className="rounded-2xl bg-canvas p-3 text-xs text-ink-soft">
      <video ref={videoRef} className="hidden" playsInline muted />
      {multiPerson
        ? '한 카메라에는 한 명만 보이게 앉아 주세요.'
        : modelStatus === 'ready'
          ? '얼굴과 양쪽 어깨를 1.5초 동안 확인하고 있어요…'
          : '감지 모델을 준비하고 있어요…'}
    </div>
  )
}
