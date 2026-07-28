# POSTURE ENGINE SPEC

## 0. 목적

일반 노트북 정면 웹캠에서 사용자의 개인 기준 대비 머리·상체 변화가 일정 시간 지속되는지 판단합니다. 이 엔진은 의료 진단 도구가 아닙니다.

## 1. 기술 선택

- `@mediapipe/tasks-vision`
- Pose Landmarker
- 1인 감지
- live video 또는 video mode
- 원본 프레임은 브라우저 메모리에서만 사용

Face Landmarker는 눈 피로·표정 기능을 별도로 확정하기 전에는 사용하지 않습니다.

## 2. 하지 않는 것

- 임상 CVA 절대값
- C7 위치 추정
- 경추 전만·척추 정렬
- 통증 원인
- 정상·비정상
- 실제 집중 상태
- 프레임별 점수 영구 저장

## 3. 입력 랜드마크 후보

- nose
- left/right eye
- left/right ear
- left/right shoulder
- left/right hip · 화면에 안정적으로 보일 때만

모델의 깊이값은 실제 cm로 해석하지 않습니다.

## 4. 정규화

카메라 거리와 해상도 영향을 줄이기 위해 아래 비율을 사용합니다.

- 어깨 너비
- 얼굴 폭
- 얼굴 중심과 어깨 중심 거리
- 프레임 대비 신체 크기

가시성 부족, 어깨 너비 최소값 미달, 부분 가림에서는 판정을 중지합니다.

## 5. 특징값

### 머리 좌우 기울기

눈 또는 귀 선의 기울기를 개인 기준과 비교합니다.

### 어깨 높이 차이

좌우 어깨 y 차이를 어깨 너비로 정규화합니다.

### 머리·상체 전방 변화 프록시

정면 단안 웹캠으로 실제 전방 거리를 측정하지 않습니다. 아래 변화를 조합한 대리 지표만 사용합니다.

- 얼굴 크기 변화
- 코·귀의 상대 깊이 변화
- 얼굴 중심·어깨 중심 관계
- 개인 기준 대비 상체가 카메라에 가까워진 패턴

### 상체 기울기

엉덩이가 보일 때만 보조값으로 사용합니다.

## 6. 캘리브레이션

### 데이터 구조

```ts
interface CalibrationProfile {
  id: string;
  name: string;
  createdAt: number;
  baseline: FeatureVector;
  variance: FeatureVector;
  optionalSlouchReference?: FeatureVector;
  quality: {
    sampleCount: number;
    meanVisibility: number;
    stabilityScore: number;
  };
}
```

원본 프레임과 랜드마크 시계열은 저장하지 않습니다.

### 품질 조건

5초 동안:

- 인물 지속 감지
- 얼굴·양쪽 어깨 가시성
- 큰 움직임 없음
- 프레임 내 위치 안정
- 조명·모델 신뢰도 기준

## 7. 선택형 흐트러짐 참조 · P1

`나쁜 자세` 정답이 아니라 사용자가 자주 보이는 변화 방향의 참고값입니다.

활용:

- 변화 방향 분류
- 문구 선택
- 개인 기준에서 멀어졌지만 평소 흐트러짐과 다른 행동을 과도하게 경고하지 않도록 보조

## 8. 품질 상태

### away

- 주요 랜드마크가 일정 시간 없음
- 사람 크기가 너무 작음

### unstable

- 일부만 보임
- 가시성 낮음
- 급격한 카메라 이동
- 조명 변화
- 특징값 분산 과다
- 모델 준비 실패

## 9. 상태 계산

### 편차 벡터

```ts
interface FeatureDeviation {
  headTilt: number;
  shoulderTilt: number;
  forwardProxy: number;
  torsoLean?: number;
}
```

### 초기 가중치

```text
forwardProxy 0.50
headTilt     0.20
shoulderTilt 0.20
torsoLean    0.10
```

엉덩이가 보이지 않으면 나머지 값을 재정규화합니다.

### 민감도

| 모드 | 허용 범위 |
|---|---|
| 부드럽게 | 넓음 |
| 기본 | 중간 |
| 민감하게 | 좁음 |

숫자 각도를 사용자에게 표시하지 않습니다.

### 안정화

- 지수 이동 평균
- 극단값 제한
- 상태 진입·복귀 임계값 분리
- 최소 지속 시간
- 시간은 `performance.now()` 기반

## 10. 기본 상태 전이

```text
good
→ 편차 증가
→ warning
→ 편차 지속
→ bad
```

`bad` 5초 지속 후 회복 기회를 시작합니다.

회복 기회:

```text
good 복귀
+ 5초 안정
→ recovery success
```

## 11. 기본 상수

| 상수 | 값 | 의미 |
|---|---:|---|
| BAD_HOLD_MS | 5000 | 순간 움직임 제외 |
| RECOVERY_WINDOW_MS | 30000 | 회복 기회 |
| GOOD_RECOVERY_HOLD_MS | 5000 | 안정 복귀 |
| RECOVERY_COOLDOWN_MS | 20000 | 반복 보상 방지 |
| AUDIO_ESCALATION_MS | 15000 | 선택적 소리 |
| AWAY_PROMPT_MS | 60000 | 장기 자리 비움 확인 |
| MAX_REWARDED_RECOVERIES | 5 | XP 추가 지급 상한 |

모두 프로토타입 조정값입니다.

## 12. 엔진 출력

```ts
interface PostureEngineOutput {
  state: PostureState;
  quality: "good" | "limited" | "unavailable";
  deviationCategory?: "forward" | "tilt" | "shoulder" | "mixed";
  recoveryOpportunity?: {
    active: boolean;
    remainingMs: number;
  };
  event?:
    | "recovery_started"
    | "recovery_succeeded"
    | "recovery_missed";
}
```

UI에는 원시 편차값을 직접 노출하지 않습니다.

## 13. 세션 집계

저장 가능:

- 감지 가능 시간
- away 시간
- unstable 시간
- 회복 기회
- 회복 성공
- 가장 빠른 회복
- 최고 콤보
- 변화 방향 집계

저장 금지:

- 프레임별 랜드마크
- 얼굴 이미지
- 영상
- 프레임별 편차 로그
- 의료 등급

## 14. 성능

- 모델과 WASM 지연 로딩
- 입력 FPS 제한
- 같은 프레임 중복 처리 금지
- 탭 비활성 상태 처리
- 필요 시 Web Worker 검토
- 저사양 기기에서는 분석 FPS를 낮추고 타이머·UI는 유지

## 15. QA

카메라 없이 아래 상태를 수동 주입합니다.

- good
- warning
- bad
- away
- unstable
- recovery success
- quality low

## 16. 알려진 한계

- 정면 웹캠으로 실제 목 전방 거리를 정밀 측정하지 못함
- 카메라 높이·조명·가림 영향
- 책·태블릿을 내려다보는 행동 오판 가능
- 두 번째 모니터를 보는 행동 오판 가능
- 깊이값은 실제 거리 아님

모든 사용자 문구는 `개인 기준 대비 변화`로 제한합니다.
