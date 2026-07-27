import { useEffect, useRef } from 'react'
import { useCamera } from '@/features/calibration/useCamera'
import { usePoseDetection, type ModelStatus, type PoseFrame } from './usePoseDetection'
import {
  arbiterStep,
  computeVotes,
  createArbiter,
  isDistanceMismatch,
  type ArbiterState,
} from './classify'
import { MIN_SHOULDER_WIDTH, type FeatureKey } from './features'
import { usePostureStore } from './postureStore'
import { usePostureDebugStore } from './postureDebugStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import type { DetectionQuality } from '@/types'

/**
 * 카메라 + Pose + 분류를 postureStore 로 잇는 라이브 분류기 (긴급 안정화판)
 *
 * - 귀·엉덩이·z 가 없어도 unavailable 로 만들지 않습니다 → limited 로 계속 판정.
 * - 마지막 신뢰 상태를 800ms 유지해 한 프레임 누락으로 깜빡이지 않게 합니다.
 * - 어깨 너비가 기준보다 35% 이상 3초 지속으로 달라지면 bad 대신
 *   "카메라 거리 확인" 안내를 냅니다. (특징은 어깨 너비로 정규화되어
 *   의자에 기대는 정도의 거리 변화(±20%대)에는 기준이 그대로 유효합니다)
 * - 비디오가 2.5초 이상 멈추면 unavailable 처리합니다.
 *   (백그라운드 탭에서 브라우저가 타이머를 늦춰도 바로 튀지 않도록 여유)
 * - 특징값은 EMA 로 스무딩합니다. 캘리브레이션 기준은 5초 중앙값인데
 *   세션은 raw 단일 프레임을 쓰면 자연 흔들림이 전부 이탈로 계산되던
 *   비대칭을 없앱니다. (12fps 기준 시간상수 ~0.25초 — bad 5초 확정에
 *   영향을 주지 않습니다)
 */
const HOLD_LAST_MS = 800
const AWAY_MISS_FRAMES = 8
const DISTANCE_TOLERANCE = 0.35
const DISTANCE_HOLD_MS = 3000
const STALE_MS = 2500
/** 판정을 계속하기 위한 최소 신뢰(주) 특징 수 */
const MIN_TRUSTED_FEATURES = 2
/** 특징 EMA 계수 — 프레임 간 지터 흡수용 */
const EMA_ALPHA = 0.35
/** 이 시간 이상 프레임이 끊기면 EMA 를 새로 시작합니다. */
const EMA_RESET_GAP_MS = 2000

export function useLiveClassifier(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  cameraState: ReturnType<typeof useCamera>['state'],
): { modelStatus: ModelStatus } {
  const profile = useCalibrationStore((s) => s.profile)
  const sensitivity = useCalibrationStore((s) => s.sensitivity)

  const arbiterRef = useRef<ArbiterState>(createArbiter())
  const missRef = useRef(0)
  const lastTrustedAtRef = useRef(0)
  const lastFrameAtRef = useRef(0)
  const distanceSinceRef = useRef<number | null>(null)
  const emaRef = useRef<Partial<Record<FeatureKey, number>>>({})
  const profileRef = useRef(profile)
  profileRef.current = profile
  const sensitivityRef = useRef(sensitivity)
  sensitivityRef.current = sensitivity

  const enabled = cameraState.status === 'ready'

  const { modelStatus } = usePoseDetection(videoRef, {
    enabled,
    onFrame: (frame: PoseFrame) => {
      const now = performance.now()
      // 프레임이 오래 끊겼다 돌아오면 이전 자세와 섞이지 않게 EMA 를 리셋합니다.
      if (now - lastFrameAtRef.current > EMA_RESET_GAP_MS) emaRef.current = {}
      lastFrameAtRef.current = now
      const store = usePostureStore.getState()
      const debug = usePostureDebugStore.getState()
      const prof = profileRef.current
      const { analysis, multiPerson } = frame

      const holdActive = now - lastTrustedAtRef.current < HOLD_LAST_MS

      const fail = (
        quality: DetectionQuality,
        reason: string,
        state: 'away' | 'unstable',
      ) => {
        debug.report({
          points: analysis?.points ?? null,
          shoulderWidth: analysis?.shoulderWidth ?? null,
          baselineShoulderWidth: prof?.shoulderWidthMedian ?? null,
          quality,
          qualityReason: reason,
          details: [],
          excluded: analysis?.excluded ?? {},
          voters: [],
          voteWarning: false,
          voteBad: false,
          arbiter: arbiterRef.current.current,
          instant: holdActive ? store.instant : state,
          distanceMismatch: false,
          yawRatio: analysis?.yawRatio ?? 0,
          multiPerson,
        })
        // 짧은 프레임 누락은 마지막 신뢰 상태를 유지합니다.
        if (!holdActive) {
          store.setInstant(state, quality)
          // away/unstable 동안에는 bad 확정용 지속 시간도 진행하지 않습니다.
          arbiterRef.current = {
            ...arbiterRef.current,
            candidate: null,
            candidateSince: now,
          }
        }
      }

      // ---- 인물 미감지 → away (연속 프레임 기준)
      if (!analysis) {
        missRef.current += 1
        if (missRef.current >= AWAY_MISS_FRAMES) {
          fail('unavailable', '인물 미감지', 'away')
        }
        return
      }
      missRef.current = 0

      // ---- unavailable 판별 (필수 랜드마크 기준)
      if (multiPerson) return fail('unavailable', '두 명 이상 인식', 'unstable')
      if (!analysis.faceCoreOk)
        return fail('unavailable', '얼굴 핵심(코·눈) 미감지', 'unstable')
      if (!analysis.bothShouldersOk)
        return fail('unavailable', '한쪽 어깨 미감지', 'unstable')
      if (analysis.shoulderWidth < MIN_SHOULDER_WIDTH)
        return fail('unavailable', '어깨 너비가 지나치게 작음', 'unstable')
      if (!analysis.inFrame)
        return fail('unavailable', '몸이 프레임을 벗어남', 'unstable')
      if (analysis.severeRotation)
        return fail('unavailable', '얼굴이 크게 옆으로 돌아감', 'unstable')
      if (!prof) return fail('unavailable', '캘리브레이션 기준 없음', 'unstable')

      // ---- 카메라 거리 확인 (bad 오탐 방지)
      const baseSW = prof.shoulderWidthMedian
      if (isDistanceMismatch(analysis.shoulderWidth, baseSW, DISTANCE_TOLERANCE)) {
        distanceSinceRef.current ??= now
        if (now - distanceSinceRef.current >= DISTANCE_HOLD_MS) {
          if (store.notice !== 'camera-distance') store.setNotice('camera-distance')
          debug.report({
            points: analysis.points,
            shoulderWidth: analysis.shoulderWidth,
            baselineShoulderWidth: baseSW,
            quality: 'limited',
            qualityReason: '카메라 거리가 기준과 35% 이상 다름',
            details: [],
            excluded: analysis.excluded,
            voters: [],
            voteWarning: false,
            voteBad: false,
            arbiter: arbiterRef.current.current,
            instant: 'unstable',
            distanceMismatch: true,
            yawRatio: analysis.yawRatio,
            multiPerson: false,
          })
          store.setInstant('unstable', 'limited')
          return
        }
      } else {
        distanceSinceRef.current = null
        if (store.notice === 'camera-distance') store.setNotice(null)
      }

      // ---- 품질: 선택 랜드마크(귀·엉덩이)까지 다 보이고 고개 돌림이 없으면 good.
      //      일부 가려짐·고개 돌림은 limited — 판정은 계속하되 단독 강신호
      //      bad 경로만 잠급니다.
      const quality: DetectionQuality =
        analysis.earsOk && analysis.hipsOk && !analysis.moderateRotation
          ? 'good'
          : 'limited'

      // ---- EMA 스무딩 — 이번 프레임에 없는 특징은 남기지 않습니다.
      const smoothed: Partial<Record<FeatureKey, number>> = {}
      for (const [key, value] of Object.entries(analysis.features) as Array<
        [FeatureKey, number]
      >) {
        const prev = emaRef.current[key]
        smoothed[key] =
          prev === undefined ? value : prev + EMA_ALPHA * (value - prev)
      }
      emaRef.current = smoothed

      const votes = computeVotes(
        smoothed,
        prof,
        sensitivityRef.current,
        quality === 'good',
      )

      // 남은 신뢰(주) 특징이 2개 미만이면 판정하지 않습니다.
      const trustedPrimary = votes.details.filter((d) => d.primary).length
      if (trustedPrimary < MIN_TRUSTED_FEATURES) {
        return fail('unavailable', `신뢰 특징 부족 (${trustedPrimary}개)`, 'unstable')
      }

      lastTrustedAtRef.current = now
      arbiterRef.current = arbiterStep(arbiterRef.current, votes, now)
      const state = arbiterRef.current.current

      debug.report({
        points: analysis.points,
        shoulderWidth: analysis.shoulderWidth,
        baselineShoulderWidth: baseSW,
        quality,
        qualityReason:
          quality === 'limited'
            ? [
                !analysis.earsOk ? '귀 일부 미감지(보조)' : null,
                !analysis.hipsOk ? '엉덩이 화면 밖(보조)' : null,
                analysis.moderateRotation ? '고개 돌림(측정 제한)' : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : null,
        details: votes.details,
        excluded: analysis.excluded,
        voters: votes.details.filter((d) => d.exceeded).map((d) => d.key),
        voteWarning: votes.voteWarning,
        voteBad: votes.voteBad,
        arbiter: state,
        instant: state,
        distanceMismatch: false,
        yawRatio: analysis.yawRatio,
        multiPerson: false,
      })

      usePostureStore.getState().setInstant(state, quality)
    },
  })

  // 비디오 정지 감시 — 프레임이 멈추면 unavailable 처리합니다.
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      const now = performance.now()
      if (
        lastFrameAtRef.current > 0 &&
        now - lastFrameAtRef.current > STALE_MS
      ) {
        usePostureStore.getState().setInstant('unstable', 'unavailable')
        usePostureDebugStore
          .getState()
          .report({ quality: 'unavailable', qualityReason: '비디오 프레임 정지' })
      }
    }, 500)
    return () => window.clearInterval(timer)
  }, [enabled])

  // 카메라가 꺼지면 다음 세션을 위해 상태를 초기화합니다.
  useEffect(() => {
    if (!enabled) {
      arbiterRef.current = createArbiter()
      missRef.current = 0
      lastTrustedAtRef.current = 0
      lastFrameAtRef.current = 0
      distanceSinceRef.current = null
      emaRef.current = {}
      usePostureDebugStore.getState().reset()
      usePostureStore.getState().setNotice(null)
    }
  }, [enabled])

  return { modelStatus }
}
