import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision'

/**
 * Pose Landmarker 지연 로드 — docs/06 §1, §14
 * 무거운 tasks-vision 라이브러리는 동적 import 로 분리해, 카메라를 쓸 때만 받습니다.
 * WASM·경량 모델은 CDN 에서 받고, GPU 실패 시 CPU 로 폴백합니다.
 * 추론은 브라우저 안에서만 수행하고 프레임을 네트워크로 보내지 않습니다.
 */
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let landmarkerPromise: Promise<PoseLandmarker> | null = null

async function build(delegate: 'GPU' | 'CPU'): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import(
    '@mediapipe/tasks-vision'
  )
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    // 2로 두어 "두 명 이상 인식" 상황을 감지합니다. 판정에는 첫 번째 사람만 씁니다.
    numPoses: 2,
  })
}

export async function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (landmarkerPromise) return landmarkerPromise

  landmarkerPromise = build('GPU').catch((gpuError) => {
    console.warn('Pose Landmarker GPU 실패, CPU 로 폴백합니다.', gpuError)
    return build('CPU')
  })

  try {
    return await landmarkerPromise
  } catch (error) {
    // 실패하면 다음 시도를 위해 캐시를 비웁니다.
    landmarkerPromise = null
    throw error
  }
}

export function disposePoseLandmarker(): void {
  if (!landmarkerPromise) return
  landmarkerPromise
    .then((lm) => lm.close())
    .catch(() => {})
    .finally(() => {
      landmarkerPromise = null
    })
}

export type { PoseLandmarkerResult }
