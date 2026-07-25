# AI_HANDOFF — UpRight Now 작업 인수인계

> 마지막 갱신: 2026-07-25 · PIP 완성 + 친구 방 최종 통합 대기

## 현재 상태 요약

- **Production**: https://upright-now.vercel.app
- **GitHub**: https://github.com/suhyunkim1105-hash/upright-now (main)
- MVP 완성: 카메라 자세 감지 · 캘리브레이션 v2 · 회복 게임 · 세션/기록 ·
  성장 · 상점(구매/장착) · 설정(민감도/초기화) · 스트레칭 6종 ·
  친구 방 코드(플래그 off)
- 기존 프로젝트 `C:\Users\수현\Desktop\거부기탈출` 은 읽기 전용 참고. 수정 금지.

## 자세 판정 파이프라인 (시간 소유권 주의)

```
카메라 → usePoseDetection(12fps, numPoses 2)
→ analyzeLandmarks (core=코/눈+양어깨, optional=귀/엉덩이/z)
→ computeVotes (방향성 편차 / MAD tolerance / z 는 보조)
→ arbiterStep (★ 지속시간의 유일한 소유자: warning 1.5s · bad 5s · good 2s)
→ postureStore.setInstant → postureMachine (확정 bad 진입 "즉시" 회복 기회.
                                            여기서 5초를 다시 세지 않는다)
→ 회복 창 30s · good 5s → 성공 · 냉각 20s
→ PostureGameBridge → gameStore(전투) + applyReward(보상) + 친구방 reportRecovery
```

- 이탈 시작 → 회복 기회 = 총 5초. away/unstable 은 모든 타이머 동결.
- posture engine·calibration·recovery 타이밍·applyReward·finalize 구조는
  승인된 상태 — 필요 없이 재설계 금지.

## 보상 (단일 진입점)

- `features/game/rewards.ts` `applyReward({id, sessionId, type})` 만 XP/포인트 적립
  + `recentXp` 최근 5개 기록
- recovery 30/10(세션당 XP 5회 상한) · session_completed 100/100 ·
  stretch 20/20 · goal 20/20
- 종료는 `finalizeSession` 만: 완료 인정 = 타이머 종료 또는 80% 이상.
  중도 종료 = 기록만, 보상·출석 0.

## 상점·성장 (Gate 1)

- `constants/storeItems.ts`: 과잠 4종 100P · 백팩 3종 80P
- progressionStore: `purchaseItem(중복·부족 차단)` · `equipItem(과잠/백팩 각 1개)`
- 잠금: 첫 정상 세션 완료(`shopUnlocked`) 전에는 상점 잠김
- 의상 이미지 레이어 전까지 `CharacterWithGear` 가 색 리본·아이콘 배지로 표시
  (equippedJacketId/equippedBackpackId 분리 유지 → 이미지 레이어 교체 용이)
- 성장 단계는 XP 파생(`xpToStage`) — stage 별도 저장 금지

## 친구 방 (Gate 2 — 코드 완성, 플래그 off)

- `features/rooms/`: roomService(익명 인증·RPC·Presence·Broadcast·30s 재연결) ·
  roomStore · giraffeSync(10s 창, 이벤트 재사용 금지) · roomEvents(payload 검증)
- 공동 보스 HP 2000, 회복 -40 · 완주 -100 · 기린 싱크 -60 · 스트레칭 방어막 +15
- HP 는 DB `rooms.boss_hp` 가 최종 기준, `apply_room_damage`/`apply_room_shield`
  RPC 로만 원자적 변경 (event_id 중복 차단)
- 전송 금지: 영상·프레임·랜드마크·좌표·bad 상태 — `sanitizeRoomEvent` 가 차단
- **활성화 절차 (env 만 넣으면 끝)**:
  1. Supabase 프로젝트 생성 → Authentication 에서 Anonymous Sign-Ins 켜기
  2. SQL Editor 에서 `supabase/schema.sql` 전체 실행 (boss 2000·shield 포함)
  3. Vercel(Production) + 로컬 `.env.local` 에 env 3개:
     `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_ENABLE_FRIEND_ROOM=true`
  4. 라이브 2인 검증: `npx playwright test e2e/room-live.spec.ts`
     (두 독립 컨텍스트로 생성→입장→준비→시작→HP 동기화→기린 싱크→금지 payload 0건을
      자동 검증. env 없으면 자동 skip)
- env 없이도 혼자 모드 전 기능 정상 (테스트로 보장)

## 저장 (localStorage v2)

- `upright-now:{user,progression,calibration,sessions}` · 데모 값 저장 금지
- v1→v2 마이그레이션: 데모 시드만 초기화, 획득 데이터 보존
- 전체 초기화: `features/settings/dataReset.ts` (설정 화면, 확인 모달)

## 플래그·도구

- Production env: `VITE_ENABLE_CAMERA=true` (QA Lab·friendRoom off)
- Preview: `VITE_ENABLE_QA_LAB=true` 로 /lab(상태 주입 + Posture Debug 계기판),
  `/calibration?postureDebug=1` 오버레이, `window.__upright`

## 검증

```
npm run lint / typecheck / test / test:e2e / build
```
173 unit + 67 e2e 통과(+room-live 1 skip). e2e 는 포트 5273 자체 서버.

## 남은 리스크 / 다음 작업

1. 실카메라 임계값(tolerance 바닥값·yaw 0.7)은 합성 데이터 기준 — 실기기 튜닝 필요
2. 친구 방: Supabase 자격 증명이 아직 없어 라이브 미검증 — 위 활성화 절차 4단계면 끝
3. Lv.2/4/5/6 상태 에셋 · 의상 이미지 레이어 · 모션 WebM 미보유
4. recovery_started 토스트 카피("돌아오는 중이에요") 검토
