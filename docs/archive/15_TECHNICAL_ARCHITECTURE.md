# TECHNICAL ARCHITECTURE

## 1. 목표

브라우저 안에서 자세 영상 처리를 완료하고, 필요한 요약과 게임 이벤트만 저장·공유하는 React 웹앱을 구현합니다.

```text
Browser
├─ React UI
├─ Session Engine
├─ MediaPipe Pose Engine
├─ Character Renderer
├─ Game Engine
├─ IndexedDB
└─ Supabase Realtime · 2인 방
```

## 2. 권장 스택

| 영역 | 권장 기술 |
|---|---|
| 앱 | React + Vite + TypeScript |
| 라우팅 | React Router |
| 상태 | Zustand 또는 Reducer |
| 스타일 | Tailwind CSS 또는 CSS Modules |
| 자세 | `@mediapipe/tasks-vision` Pose Landmarker |
| 검증 | Zod |
| 로컬 DB | IndexedDB + Dexie |
| 실시간 | `@supabase/supabase-js` |
| 캐릭터 | WebP + WebM |
| 모션 | Motion 계열 |
| 단위 테스트 | Vitest + Testing Library |
| E2E | Playwright |
| 배포 | Vercel |

라이브러리의 정확한 버전은 프로젝트 생성 시 호환되는 안정 버전을 잠급니다.

## 3. 모듈 경계

### App Shell

- 라우팅
- 전역 오류 경계
- 테마·접근성
- 기능 플래그

### Onboarding

- 닉네임
- 학습 프로필
- 카메라 안내

### Posture Engine

입력:

- MediaPipe 랜드마크
- 개인 기준
- 민감도
- 시간

출력:

- posture state
- quality
- recovery event

### Session Engine

- 타이머
- away·unstable 시간
- 완료·중단
- 리셋
- 세션 요약

### Game Engine

- 데미지
- 보스 HP
- XP·포인트
- 콤보
- 냉각
- 성장 단계

### Character Renderer

- stage + state → asset
- 과잠·백팩 레이어
- 감소된 모션
- 에셋 폴백

### Stretch Engine

- 모드별 가중치
- 최근 이력
- 추천
- 완료 보상

### Social Room

- 익명 인증
- 방 생성·입장
- Presence
- Broadcast
- DB HP 동기화
- 재연결

### Storage

- Dexie schema
- migration
- 전체 초기화

## 4. 권장 폴더

```text
src/
├─ app/
│  ├─ routes/
│  ├─ providers/
│  └─ App.tsx
├─ components/
│  ├─ ui/
│  ├─ layout/
│  ├─ character/
│  ├─ posture/
│  ├─ session/
│  ├─ game/
│  ├─ stretch/
│  └─ room/
├─ features/
│  ├─ onboarding/
│  ├─ profiles/
│  ├─ calibration/
│  ├─ posture-engine/
│  ├─ sessions/
│  ├─ progression/
│  ├─ store/
│  ├─ rooms/
│  └─ settings/
├─ lib/
│  ├─ mediapipe/
│  ├─ storage/
│  ├─ supabase/
│  ├─ validation/
│  └─ feature-flags/
├─ assets/
│  ├─ characters/
│  ├─ items/
│  ├─ motions/
│  └─ sounds/
├─ constants/
├─ types/
└─ test/
```

## 5. 로컬 데이터 모델

```ts
interface UserPreference {
  nickname: string;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  reducedMotion: boolean;
  defaultProfileId?: string;
}

interface LearningProfile {
  id: string;
  name: string;
  kind: "library" | "home" | "team" | "custom";
  calibrationProfileId: string;
  sensitivity: "gentle" | "default" | "sensitive";
  soundEnabled: boolean;
  ambientEffect: "off" | "low" | "medium";
  awayBehavior: "continue" | "prompt" | "pause";
}

interface SessionSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  status: "completed" | "aborted";
  subject?: string;
  goal?: string;
  plannedDurationMs: number;
  elapsedMs: number;
  detectableMs: number;
  awayMs: number;
  unstableMs: number;
  recoveryOpportunities: number;
  recoveries: number;
  fastestRecoveryMs?: number;
  bestCombo: number;
  damageDealt: number;
  xpEarned: number;
  pointsEarned: number;
  targetProgress?: "done" | "mostly" | "half" | "little";
}
```

## 6. 카메라 데이터 흐름

```text
getUserMedia
→ video element
→ MediaPipe PoseLandmarker
→ landmarks in memory
→ normalized feature vector
→ posture state machine
→ recovery event
→ UI and game
```

네트워크 전송 없음.

## 7. 친구 방 데이터 흐름

```text
recovery success
→ Zod event validation
→ private Supabase Broadcast
→ atomic boss damage RPC
→ rooms.boss_hp update
→ clients receive state
```

Presence에는 느린 참가 상태만 넣습니다.

## 8. 환경 변수

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_ENABLE_REALTIME
VITE_ENABLE_PIP
VITE_ENABLE_QA_LAB
```

## 9. PIP

```text
feature detection
→ supported: Document PIP
→ unsupported: in-page mini widget
```

PIP에 카메라 영상을 넣지 않습니다.

## 10. 에셋 로딩

- 대시보드 진입: 현재 단계 WebP preload
- 세션 시작: 현재 단계 상태 에셋 preload
- 공격 WebM lazy load
- 미래 성장 단계는 growth 화면에서 lazy load
- 에셋 실패 시 기본 SVG·텍스트

## 11. 성능

- MediaPipe 추론 빈도 제한
- 랜드마크 계산과 React 렌더 분리
- requestAnimationFrame 또는 video frame callback
- 3D 렌더링 없음
- WebM 모션 짧게
- 불필요한 Realtime 이벤트 금지
- Presence track 호출 빈도 제한
- 탭 비활성 시 처리량 조절

## 12. 분석·로그

프로토타입은 서버 분석 없이도 동작합니다.

허용 로그:

- 모델 로딩 성공·실패
- 카메라 권한 상태
- PIP 지원
- 저장 오류 코드
- Realtime 연결 상태

금지 로그:

- 프레임
- 랜드마크
- 자세 편차
- 얼굴
- 닉네임과 자세 이벤트 결합

## 13. 기능 플래그

```ts
interface FeatureFlags {
  realtimeRoom: boolean;
  pictureInPicture: boolean;
  qaLab: boolean;
  optionalSlouchCalibration: boolean;
}
```

Supabase가 없는 로컬 환경에서도 혼자 모드가 작동해야 합니다.

## 14. 오류 폴백

| 실패 | 폴백 |
|---|---|
| MediaPipe | QA 데모·재시도 |
| 카메라 | 권한 복구·데모 |
| 캐릭터 에셋 | 기본 SVG·텍스트 |
| WebM | 정지 WebP |
| PIP | 미니 위젯 |
| Supabase | 혼자 모드 |
| IndexedDB | 메모리 결과 유지·재시도 |
