import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/constants/routes'
import { PRIVACY } from '@/constants/copy'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCamera } from '@/features/calibration/useCamera'
import { usePoseDetection, type PoseFrame } from '@/features/posture-engine/usePoseDetection'
import {
  collectStep,
  createCollectState,
  MIN_VALID_SAMPLES,
  type CalibrationQuality,
} from '@/features/calibration/collect'
import {
  hashDeviceId,
  useCalibrationStore,
} from '@/features/calibration/calibrationStore'
import { useUserStore } from '@/features/onboarding/userStore'
import type { LandmarkAnalysis, PointName } from '@/features/posture-engine/features'

const QUALITY_COPY: Record<CalibrationQuality, string> = {
  idle: '카메라를 준비하고 있어요.',
  warming: '카메라를 준비하고 있어요. 곧 시작할게요.',
  ok: '좋아요. 그대로 잠깐 유지해 주세요.',
  'no-person': '화면 중앙에 앉아 얼굴이 보이도록 해 주세요.',
  'low-visibility': '얼굴과 양쪽 어깨가 보이게 앉고 주변을 조금 밝혀 주세요.',
  moving: '잠깐 편안한 자세를 유지해 주세요.',
  rotated: '화면 정면을 바라봐 주세요.',
  timeout: '표본을 충분히 모으지 못했어요. 자세를 잡고 다시 시작할게요.',
}

const CAMERA_ERROR_COPY: Record<string, string> = {
  'permission-denied':
    '카메라 권한이 필요해요. 브라우저 주소창의 권한을 허용하고 다시 시도해 주세요.',
  'no-device': '연결된 카메라를 찾지 못했어요. 카메라를 연결하고 다시 시도해 주세요.',
  'in-use': '다른 앱이 카메라를 사용 중일 수 있어요. 해당 앱을 닫고 다시 시도해 주세요.',
  unknown: '카메라를 여는 중 문제가 생겼어요. 다시 시도해 주세요.',
}

/** ?postureDebug=1 일 때만 표시하는 랜드마크 오버레이 */
function LandmarkOverlay({ analysis }: { analysis: LandmarkAnalysis | null }) {
  if (!analysis) return null
  const line = (a: PointName, b: PointName) => {
    const p = analysis.points[a]
    const q = analysis.points[b]
    if (!p.present || !q.present) return null
    return (
      <line
        key={`${a}-${b}`}
        x1={p.x * 100}
        y1={p.y * 100}
        x2={q.x * 100}
        y2={q.y * 100}
        stroke="#5F8FF7"
        strokeWidth={0.7}
      />
    )
  }
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
      aria-hidden="true"
    >
      {line('leftEyeOuter', 'rightEyeOuter')}
      {line('leftShoulder', 'rightShoulder')}
      {line('leftHip', 'rightHip')}
      {(Object.keys(analysis.points) as PointName[]).map((name) => {
        const p = analysis.points[name]
        if (!p.present) return null
        const core =
          name === 'nose' ||
          name.includes('EyeOuter') ||
          name.includes('Shoulder')
        return (
          <circle
            key={name}
            cx={p.x * 100}
            cy={p.y * 100}
            r={core ? 1.3 : 0.9}
            fill={core ? '#F45B8D' : '#F2C94C'}
          />
        )
      })}
    </svg>
  )
}

/** S-05 캘리브레이션 — 5초 개인 기준 등록 (워밍업 1초 + 유효 40프레임) */
export function Calibration() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const collectRef = useRef(createCollectState())
  const { state: camera, start, stop } = useCamera(videoRef)
  const setProfile = useCalibrationStore((s) => s.setProfile)
  const setCalibrated = useUserStore((s) => s.setCalibrated)

  const debugOverlay = new URLSearchParams(location.search).get('postureDebug') === '1'

  const [quality, setQuality] = useState<CalibrationQuality>('idle')
  const [progress, setProgress] = useState(0)
  const [validCount, setValidCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [modelError, setModelError] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<LandmarkAnalysis | null>(null)

  useEffect(() => {
    if (!featureFlags.camera) return
    start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { modelStatus } = usePoseDetection(videoRef, {
    enabled: featureFlags.camera && camera.status === 'ready' && !saved,
    onFrame: (frame: PoseFrame) => {
      if (debugOverlay) setLastAnalysis(frame.analysis)

      const step = collectStep(collectRef.current, {
        analysis: frame.multiPerson ? null : frame.analysis,
        now: performance.now(),
        deviceIdHash: hashDeviceId(camera.deviceId),
      })
      collectRef.current = step.state
      setQuality(step.quality)
      setProgress(step.progress)
      setValidCount(step.validCount)

      if (step.profile) {
        // 개인 기준 요약(중앙값·MAD·표본 수)만 저장합니다. 원본은 저장하지 않습니다.
        setProfile(step.profile)
        setCalibrated(true)
        setSaved(true)
      }
    },
  })

  useEffect(() => {
    if (modelStatus === 'error') setModelError(true)
  }, [modelStatus])

  if (!featureFlags.camera) {
    return (
      <AppShell chrome="focus">
        <PageHeader
          title="자세 기준 등록"
          description="얼굴과 양쪽 어깨가 보이도록 편안하게 앉은 자세를 5초 동안 등록해요."
          back={ROUTES.camera}
        />
        <Card tone="yellow">
          <p className="text-sm font-bold text-ink">
            지금은 카메라 없이 데모로 흐름을 확인할 수 있어요.
          </p>
          <Button className="mt-4" onClick={() => navigate(ROUTES.sessionSetup)}>
            3분 데모로 이동
          </Button>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="얼굴과 양쪽 어깨가 보이도록 편안하게 앉아 주세요"
        description="이 환경의 편안한 자세를 5초 동안 기준으로 등록해요. 영상은 저장하지 않아요."
        back={ROUTES.camera}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          {camera.status === 'error' && camera.error ? (
            <div>
              <Badge tone="coral">카메라 오류</Badge>
              <p className="mt-3 text-sm text-ink">
                {CAMERA_ERROR_COPY[camera.error]}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => start(camera.deviceId ?? undefined)}>
                  다시 시도
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(ROUTES.sessionSetup)}
                >
                  카메라 없이 데모
                </Button>
              </div>
            </div>
          ) : modelError ? (
            <div>
              <Badge tone="coral">감지 도구 오류</Badge>
              <p className="mt-3 text-sm text-ink">
                자세 감지 도구를 준비하지 못했어요. 다시 시도하거나 데모로 확인할
                수 있어요.
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => window.location.reload()}>
                  다시 시도
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(ROUTES.sessionSetup)}
                >
                  카메라 없이 데모
                </Button>
              </div>
            </div>
          ) : saved ? (
            <div>
              <Badge tone="green">등록 완료</Badge>
              <p className="mt-3 text-base font-bold text-ink">
                이 환경의 자세 기준을 저장했어요.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                이제 이 기준과 비교해 자세 변화를 알려드려요.
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  stop()
                  navigate(ROUTES.sessionSetup)
                }}
              >
                집중 세션 설정으로
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink">
                {modelStatus === 'loading'
                  ? '자세 감지 도구를 불러오는 중이에요…'
                  : QUALITY_COPY[quality]}
              </p>
              <div className="mt-3">
                <Progress value={progress} tone="pink" label="캘리브레이션 진행" />
              </div>
              <p className="mt-2 text-xs text-ink-soft tabular">
                {`유효 표본 ${validCount} / ${MIN_VALID_SAMPLES}`}
              </p>
              <ul className="mt-4 flex flex-col gap-1.5 text-xs text-ink-soft">
                <li className="flex items-center gap-2">
                  <Icon name="check" size={14} /> 얼굴과 양쪽 어깨가 보이게 앉기
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check" size={14} /> 화면 상단 중앙에 카메라를 두고
                  조명 확인하기
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check" size={14} /> 5초간 편안하게 정면 유지하기
                </li>
              </ul>
            </div>
          )}
        </Card>

        <Card tone="canvas">
          <div className="relative overflow-hidden rounded-2xl bg-ink/5">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full -scale-x-100 object-cover"
            />
            {debugOverlay ? (
              <LandmarkOverlay analysis={lastAnalysis} />
            ) : (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="h-[62%] w-[46%] rounded-[42%] border-2 border-dashed border-white/70" />
              </div>
            )}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <Icon name="shield" size={14} />
            {PRIVACY.body}
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
