# INTEGRATION_STATUS — UpRight Now v1.1 Release Candidate

> 갱신: 2026-07-27 · 브랜치 `integration/v1.1-all-features`

## 기준 커밋

| 항목 | 값 |
|---|---|
| 통합 브랜치 | `integration/v1.1-all-features` |
| 코어 기준 | `fe7d86d` (fix/core-session-flow — 모드 실연결·사운드·프레이밍 게이트) + `eccc59a` (스크린샷 산출물) |
| 캠퍼스 기준 | `346e272` (feat/campus-territory-prototype) |
| 병합 커밋 | `99b81e8` `merge: integrate campus theme and territory prototype` |

## 병합/제외 브랜치

- **병합**: `origin/feat/campus-territory-prototype` (--no-ff)
- **제외**: `feat/v1.1-deadline-experience` (마감순경) · `audit/overnight-qa` ·
  `docs/overnight-cleanup` · main 직접 수정 없음 · Production 배포 없음

## 충돌 파일과 해결 원칙

원칙: **코어(fix/core-session-flow) 우선, 캠퍼스 기능 전부 보존, 겹치면 union.**

| 파일 | 해결 |
|---|---|
| `src/app/App.tsx` | union — 사운드 엔진 부트스트랩 + 캠퍼스 테마/기여 브리지·devApi 모두 유지 |
| `src/app/routes/LandingDashboard.tsx` | union — 실제 집중 시간(todayFocus)·현재 모드 카드 + 캠퍼스 카드 |
| `src/app/routes/Result.tsx` | union — 진행도·다음 할 일·모드 괴물 + 캠퍼스 공유 테두리·배지 |
| `src/app/routes/Room.tsx` | union — 닉네임 카드·준비 게이트 + 캠퍼스 방 배너 |
| `src/components/layout/AppShell.tsx` | 코어(BackButton) 우선 + 캠퍼스의 flex-wrap/min-w-0 좁은 폭 개선 재적용 |
| `vite.config.ts` | 동일 내용(testTimeout 15000) — 코어 측 채택 |
| 자동 병합 후 수정 | `Stretch.tsx` 캠퍼스 기여 hunk 가 코어에서 제거된 `attemptIdRef` 를 참조 → `stretchSessionIdRef` 로 교정(P0, 커밋 완료) |

## 통합 기능

- **코어**: 자세 엔진(불변)·캘리브레이션 v3+프레이밍 게이트·다중 자세 기준·
  모드 편집기 v2(soundPack/ambient/stretch/기준 연결/괴물/친구 기능)·
  Web Audio 사운드 팩·세션 직접 설정(5~120분)·스트레칭 완주 보상·
  목표 진행도/다음 할 일·친구 방 준비 게이트/반응/공동 괴물/생명주기·
  PIP(1.5s 축약)·데모 스냅샷 복원·공격 포즈 2.2s/시퀀스 3.2s
- **캠퍼스**: 학교 선택(테마 프리셋+직접 색)·비공식 안내·대시보드 카드·
  /campus·/campus/map·/campus/history·12×8 지도·타일 선택·점령/경합/방어·
  시즌·기여도·최근 변화·mock repository(BroadcastChannel+Web Locks)·
  캠퍼스 devApi·단위/E2E 테스트(플래그 ON 5284 서버)

## 기능 플래그

| 플래그 | Production | 통합 Preview |
|---|---|---|
| VITE_ENABLE_CAMERA | true | true |
| VITE_ENABLE_FRIEND_ROOM | true | true |
| VITE_ENABLE_REALTIME | (미설정=false) | true |
| VITE_ENABLE_CAMPUS_THEME | 미설정=false | true |
| VITE_ENABLE_CAMPUS_TERRITORY | 미설정=false | true |
| VITE_ENABLE_CAMPUS_SUPABASE | 미설정=false | false (mock) |
| VITE_ENABLE_QA_LAB | 미설정=false | false |

Production 환경변수는 변경하지 않았고, campus SQL 은 어떤 DB 에도 실행하지
않았습니다. 캠퍼스 영토전은 mock repository 로만 동작합니다.

## migration 상태

- localStorage: 코어 v2 스키마 + `modes` + 캠퍼스 키(`campus*`) — 충돌 없음.
  구버전 내 모드(soundEnabled)는 로드 시 soundPack 으로 이관.
- 전체 초기화(resetAllData)가 모드 스토어와 캠퍼스 학교·원장·식별자를 함께
  비움. mock 영토 저장소는 **서버 역할**이라 의도적으로 비우지 않음
  (같은 eventId 재적립 차단 유지 — recordContribution.spec 이 고정).
- Supabase 라이브 DB 필요 작업(미실행): `20260726_expand_room_duration.sql`,
  `20260726_room_lifecycle_security.sql`. campus SQL 은 실행 금지 유지.

## 통합에서 잡은 결함 (수정 완료)

1. **P0** Stretch.tsx `attemptIdRef` 컴파일 불가(자동 병합 잔재) → 교정.
2. **P1** 감지 0초 세션이 캠퍼스 +100/+50 을 받은 뒤 aborted 로 뒤집힘 →
   브리지에 detectableMs===0 게이트 추가.
3. **P1** sessionStore.mode='room' 이 sticky 라 이후 솔로 세션에 친구 보너스
   +50 오지급 → roomId 존재 시에만 반영.
4. **P1** 전체 초기화가 모드 스토어를 리셋하지 않음 → 추가.
5. **P1** 캠퍼스 스펙 2건이 코어의 결과 화면 세션 id 가드를 몰라 실패 →
   데모 모드 셋업 추가(단언 삭제·skip 없음).

## 알려진 이슈

- **P0**: 없음
- **P1**:
  - 감사 ISSUE-09/10 (판정 지터·tolerance 바닥값) — 실카메라 검증 후 조정
  - 라이브 Supabase 마이그레이션 2건 미실행(위 참조)
  - 프레이밍 게이트 18° 휴리스틱 실기기 미검증
- **P2** (통합 리뷰 발견, 문서화만):
  - 데모 스냅샷/복원이 캠퍼스 학교 선택을 포함하지 않음 — 데모 중 학교 변경이
    복원되지 않고 시즌당 변경 제한을 소모
  - QA(__upright) 주입 이벤트가 isDemo 가 아니면 실제 캠퍼스 기여를 만들 수
    있음 (QA Lab 은 Preview/Prod 에서 꺼져 있어 노출면 없음)
  - e2e 캠퍼스 spec 주석의 옛 포트 번호(5273/5274 → 실제 5283/5284)
  - campus.spec 에 플래그 부재 시 skip 가드 없음(현재는 config 가 항상 켬)

## 사용자가 직접 확인할 항목

1. Preview(Vercel 로그인)에서 학교 선택 → 사이드바·대시보드 테마 색 적용
2. /campus 지도에서 타일 선택 → 세션 완주 후 기여·점령 반영, 두 탭 동기화
3. 캠퍼스 테마가 자세 상태 색(초록/노랑/코랄)을 덮지 않는지
4. 두 기기 친구 방: 준비 게이트→시작→반응 말풍선→HP/방어막
5. 실카메라: 프레이밍 게이트(기울임 차단)·판정 지터(ISSUE-09/10)
6. 데모 진입→종료 후 XP·닉네임·캠퍼스 학교가 원상태인지

## main 병합 전 체크리스트

- [ ] 위 사용자 확인 항목 전부 통과 (특히 실카메라)
- [ ] 라이브 Supabase 에 duration/lifecycle 마이그레이션 실행
- [ ] Production 플래그 결정 (campus 는 기본 false 유지 권장)
- [ ] P2 4건 처리 여부 결정
- [ ] Lv.2/4/5/6 상태 에셋·최종 캐릭터/괴물 이미지 (이번 범위 제외)
- [ ] `npm run lint/typecheck/test/test:e2e/build` 전부 green 재확인
- [ ] v1.1.0-rc 태그 후 main 병합·Production 배포는 별도 승인

## 테스트 결과 (통합 브랜치 기준)

- lint 에러 0 · typecheck 통과
- unit **335/335** (41 파일 — 코어 253 + 캠퍼스 82)
- e2e: 기본(5283, 캠퍼스 OFF) + 캠퍼스(5284, ON) 이중 서버 — 최종 수치는
  아래 완료 보고 참조 (room-live 라이브 포함)
- build 통과
