# AI_HANDOFF — UpRight Now 작업 인수인계

> 마지막 갱신: 2026-07-25 · 회복 기회 중복 5초 지연 수정 직후

## 현재 상태 요약

- **Production**: https://upright-now.vercel.app (`npx vercel deploy --prod --logs`)
- 카메라 자세 감지 MVP + 긴급 안정화(오탐 수정·캘리브레이션 v2·보상 단일화) 완료
- 미구현: 친구 방(Supabase)·상점 구매·PIP — "준비 중" 표시 유지
- 기존 프로젝트 `C:\Users\수현\Desktop\거부기탈출` 은 읽기 전용 참고. 수정 금지.

## 자세 판정 파이프라인 (시간 소유권 주의)

```
카메라 → usePoseDetection(12fps, numPoses 2)
→ analyzeLandmarks (features.ts: core=코/눈+양어깨, optional=귀/엉덩이/z)
→ computeVotes (classify.ts: 방향성 편차 / MAD tolerance / z 는 보조)
→ arbiterStep (classify.ts: ★ 지속시간의 유일한 소유자
               warning 1.5s · bad 5s(BAD_HOLD_MS) · good 2s)
→ postureStore.setInstant(확정 상태)
→ postureMachine (postureMachine.ts: 확정 bad 진입 "즉시" 회복 기회 시작.
                  여기서 5초를 다시 세지 않는다 — 중복 지연 금지)
→ 회복 창 30s · good 5s 유지 → 성공 · 냉각 20s
→ PostureGameBridge → gameStore(전투) + applyReward(보상)
```

- **이탈 시작 → 회복 기회 = 총 5초** (arbiter 5s → machine 즉시 시작)
- away/unstable: arbiter 후보와 machine 회복 창 모두 동결, 복귀 시 남은 시간부터
- QA 주입(`setPostureState('bad')`)은 arbiter 를 우회하므로 machine 이 즉시 기회를 연다
  (QA 에서 bad 클릭 = 확정 bad 주입으로 간주)

## 보상 규칙 (단일 진입점)

- `features/game/rewards.ts` — `applyReward({id, sessionId, type})` 만 XP/포인트 적립
- 표: recovery 30/10 (세션당 XP 5회 상한) · session_completed 100/100 · stretch 20/20 · goal 20/20
- 세션 종료는 `features/sessions/finalizeSession.ts` 만 사용 (atomic, sessionId 중복 차단)
- 완료 인정: 타이머 종료 또는 계획의 80% 이상. 미만이면 aborted = 완료 보상·출석 0

## 저장 (localStorage, 스키마 v2)

- `lib/storage/local.ts` — `upright-now:{user,progression,calibration,sessions}`
- v1→v2 마이그레이션: 데모 시드 잔존(700/240, 무이력 20/20)만 초기화, 획득 데이터 보존,
  v1 캘리브레이션은 폐기(특징 스키마 변경) + hasCalibration=false
- 저장 금지: 영상·프레임·랜드마크 원본·얼굴·데모 값 (데모는 persist.ts 가드)

## 개발 도구

- `/lab` (VITE_ENABLE_QA_LAB): 상태 주입 + **Posture Debug 계기판**(visibility·특징 편차·투표)
- `/calibration?postureDebug=1`: 랜드마크 오버레이
- `window.__upright` (QA 플래그 시): setPosture/startRecovery/recoverySuccess/…
- 플래그: VITE_ENABLE_CAMERA(Prod true) · VITE_ENABLE_FRIEND_ROOM(false) · QA_LAB(Prod false)

## 검증 명령

```
npm run lint / typecheck / test / test:e2e / build
```

143 unit + 63 e2e 통과 상태. e2e 는 포트 5273 자체 서버.

## 알려진 리스크 / 다음 작업

1. **실카메라 임계값 미검증** — tolerance 바닥값·MAD×8·yaw 0.7 은 합성 데이터 기준.
   실기기에서 Debug 계기판 dev 수치로 튜닝 필요.
2. recovery_started 토스트 문구("돌아오는 중이에요")가 기회 시작 시점과 어색함 — 카피 검토.
3. QA '회복 기회 시작' 버튼은 machine 자동 시작과 중복(무해, opportunities +2 가능).
4. 다음 기능: 상점 구매·장착 → Supabase 2인 방(`supabase/schema.sql` 준비됨).
