# AI_HANDOFF — UpRight Now 작업 인수인계

> 마지막 갱신: 2026-07-25 · FINAL RELEASE FREEZE (v1.0.0-mvp)

## 현재 상태 요약

- **Production**: https://upright-now.vercel.app
- **GitHub**: https://github.com/suhyunkim1105-hash/upright-now (main)
- 릴리스 태그: v1.0.0-mvp · 릴리스 커밋은 git log 참조
- 구현 완료: 카메라 자세 감지 · 캘리브레이션 v2 · 회복 게임 · 세션/기록 ·
  성장 · 상점(구매/장착) · 설정(민감도/초기화·PIP 토글) · 스트레칭 6종 ·
  PIP 미니 위젯(폴백 포함) · 2인 친구 방(Production Supabase 라이브 검증)
- 전체 테스트: lint 0 · typecheck · unit 173/173 · e2e 68/68(라이브 room 포함) · build OK
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

## 친구 방 (라이브 검증 완료 — Production 활성)

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
173 unit + 68 e2e 통과(라이브 2인 room 포함). e2e 는 포트 5273 자체 서버.

## 실카메라 수동 확인 필요 (Claude 환경에서는 검증 불가)

- 정면 편안한 자세 30초 good 유지
- 귀 가림·엉덩이 화면 밖에서도 측정 지속(limited)
- 앞으로 숙여 5초 → 회복 기회, 복귀 5초 → 보상
- PIP 자동 열림(Chrome 116+)
- 두 브라우저 실기기 친구 방

## 알려진 비차단 이슈 / 다음 작업

1. 실카메라 임계값(tolerance 바닥값·yaw 0.7)은 합성 데이터 기준 — 실기기 튜닝 필요
2. 친구 방 실환경 노트: presence 메타는 participantId 로 dedupe(최신 우선), 기린 싱크 피해는 두 회복 uuid 의 XOR 파생 id 사용(원본 id 재사용 시 dedup 충돌), realtime.messages RLS 정책이 없어 표준(비 private) 채널 사용 — 정책 추가 시 private 전환 가능
3. Lv.2/4/5/6 상태 에셋 · 의상 이미지 레이어 · 모션 WebM 미보유
4. recovery_started 토스트 카피("돌아오는 중이에요") 검토

## fix/core-session-flow — 모드·캘리브레이션·협동 흐름 (2026-07-26)

### 확정: 모드별 마감 괴물
- 도서관 모드 = 책더미 괴물 **북몽이** (`bookmong`)
- 내 공간 모드 = 늘어짐 괴물 **늘몽이** (`neulmong`)
- 팀플 모드 = 팀플 괴물 **꼬몽이** (`komong`) — 친구 방 세션은 항상 꼬몽이
- 매핑은 `src/features/modes/modeStore.ts` 의 `MONSTER_THEMES` 가 단일 출처.
- 모드(기본 3종 + 내 모드 최대 3개)는 소리 기본값·연출 강도·스트레칭 추천·
  친구 기능·괴물 테마만 바꾼다. **자세 판정 임계값·XP·기록·성장은 모드와
  무관하며, 모드 변경 시 절대 초기화되지 않는다.**

### 보류: 캠퍼스 테마 (별도 스프린트)
다음 항목은 이번 범위에서 구현하지 않고 별도 스프린트로 미룬다:
학교 선택, 학교 상징색, 프로필 배지, 과잠·백팩 아이템, 시험기간·도서관 배경,
결과 공유 카드. 구현하더라도 **캠퍼스 테마는 자세 판정·보상·난이도를
절대 바꾸지 않는다** (표시 전용).

### 캘리브레이션 v3 완료 조건 (전부 충족해야 완료)
카메라·프레이밍 체크 1.5초 → 실시간 벽시계 5.0초 안정 + 유효 표본 ≥40 +
1초 버킷 5칸 각각에 유효 표본 ≥1. 빠른 프레임 40장이 5초 전에 모여도
완료되지 않는다 (`src/features/calibration/collect.spec.ts` 로 증명).
프로필은 다중 저장(`profiles[]` + `activeProfileId`)이며 요약 통계만 담고
원본 좌표·프레임은 저장하지 않는다.

### Supabase 수동 마이그레이션 필요 (라이브 DB)
`supabase/schema.sql` 하단 V1.2 블록 — rooms.duration_seconds CHECK 를
IN-목록에서 `between 180 and 7200` 범위로 변경. SQL Editor 에서 직접 실행
전까지 라이브 방은 15/25/50분 외 사용자 지정 길이를 거부한다.
