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

## 2026-07-27 후속 — 수동 검수 16개 항목 수정 (RC2)

- 방 상태 누수 4중 게이트(isRoomSessionActive)·세션 후 방 정리·heartbeat
  마이그레이션(20260727_room_presence_cleanup.sql, 라이브 미실행)
- 친구 라우팅(친구 방 만들기·입장하기)·감지 프리플라이트 준비 게이트
- 1분 빠른 점검(보상·출석·캠퍼스·괴물 0)·완료 인정 사유·상점 자동 복구
- 단일 집계 selector(홈·기록 동일)·최근 세션 3개
- 경제 v2(길이별 완주·회복 25/5·유효 집중 5분 공격·상점 신가격+특별 2종)
- 모드별 괴물 4phase 장기 진행도(세션 간 유지, 방 꼬몽이 분리)
- KST 출석 streak+마일스톤·커스텀 응원 문구(문구만, 채팅 없음)·사운드 확장
- 동적 캘리브레이션 가이드(고정선 제거)·커스텀 학교 이름(stable key)
- 36 territory 불규칙 섬 지도(기존 tileId 승계 = 데이터 무손실 migration)
- campus realtime v2 SQL(20260727_campus_realtime_v2.sql, 라이브 미실행)
- 테스트: unit 352/352 · e2e 94/94(마지막 room-live 재검증 통과) · lint 0 · build OK

## 2026-07-27 후속 2 — Supabase 보안·정합 수정 (RC2.1)

- room presence RPC 전부 멤버십 가드(is_room_member)·자기 삭제 금지·
  행 잠금 직렬화·"정확히 2명 완주"만 방 completed.
- 캠퍼스 v2 단일 기준 확정: campus_territories/…_territory_events/
  apply_campus_contribution + campus_memberships. school_id·member_hash 는
  서버가 auth.uid() 로 결정(위조 불가), 학교 변경 시즌당 1회 서버 강제,
  커스텀 학교는 created_by 소유권. SupabaseCampusRepository 전면 v2 정렬
  (v1 tiles 경로 제거), Realtime 은 territories/territory_events 구독.
- seed: 학교 프리셋 10 + 활성 시즌(클라이언트 season.ts 와 동일 규칙) +
  islandMap 과 동일한 36 territory (territorySeedManifest.json + parity
  스펙 13개로 고정).
- 검증: unit 365/365 · e2e 94/94 · lint 0 · build OK.
- **blocking**: 라이브 Supabase 통합 테스트는 "SQL 직접 실행 금지" 제약으로
  미수행 — 사용자가 두 SQL 실행 후 CAMPUS_SUPABASE=true Preview 에서
  §5 시나리오를 확인해야 함. Preview 는 mock(false) 유지 중.

## 2026-07-27 PHASE A — 승인 에셋 연결 + SQL 최종 보안 (RC3)

- 승인 에셋 124개 import(assets:import/verify 재현 가능, WebP 88, 256/512/1024):
  캐릭터 6단계·북몽이/늘몽이/꼬몽이 4phase·상점 레이어 66장·스트레칭 6장·
  캠퍼스 지도 768/1024/1536. 금지 팩(full_asset_pack)은 미사용.
- 캐릭터: idle 단일 이미지 + CSS 상태 연출(char-state-*, stage 체형별
  기준점), 공격 포즈 2.2s. 상점: back→base→jacket→front 레이어,
  특별 아이템은 mask+gradient. 괴물: MonsterViewport(피격/진화/주저앉기,
  테마 파티클). 스트레칭: 승인 카드+확대. 지도: 승인 배경 1536×1024 위
  36 폴리곤 오버레이(stable id 불변, fill 0.28~0.52).
- SQL v2.2: 기여 원장 직접 SELECT 차단, campus_school_directory 뷰
  (created_by 비노출), 점수 서버 CASE(100/50/20/20, p_points 제거),
  일일 600·회복 5회/20초·sessionId 필수, ensure_active_campus_season
  (advisory lock 시즌 자동 전환), 학교 선택 서버 확정/롤백(syncNotice),
  커스텀 학교 명시 결과(created/updated/name_conflict/ownership_conflict/
  invalid). room presence SQL 은 멤버십 가드 구조 유지 확인.
- 라이브 검증은 PHASE B — 사용자가 SQL 2건 실행 후 "SQL 2개 실행 완료. 계속."

## 2026-07-27 후속 3 — SQL 실행 전 마지막 P1 (RC3.1)

- 기타 학교 명시 저장: 라디오 선택은 입력 폼만 열고 서버를 호출하지 않음.
  [학교 정보 저장하고 선택] 버튼(이름 2~30자·짧은 이름 2~8자·HEX 색이
  모두 유효할 때만 활성)이 upsert_custom_school → select_campus_school 을
  수행하고, 서버 성공 후에만 로컬 선택을 확정. 실패(change_limit /
  change_cooldown / ownership_conflict / name_conflict / not_ready) 시
  이전 학교로 원복 + 사유별 안내. "직접 설정 학교" 임시 이름 자동 등록 제거.
  로컬 저장은 schoolId(프리셋 id 또는 `custom-<hash>` stable key)와
  customSchoolName/ShortName/Color 를 분리 보관, 구버전 schoolId='custom'
  저장분은 이름 기반 stable key 로 무손실 migration.
- 공유 커스텀 학교: 같은 이름은 소유자가 달라도 `existing` 으로 참여 허용,
  타인 학교의 표시정보 변경 시도는 `ownership_conflict` 로 거부.
- 스트레칭 서버 dedup: session_once unique index 에 stretch_completed 포함
  — 같은 stretchSessionId 는 eventId 를 바꿔도 1회만 적립.
- 동시성: apply_campus_contribution 이 per-user advisory lock 을 잡은 뒤
  일일 600점·회복 5회/20초·중복을 재검사 (동시 요청 한도 우회 차단).
- 학교 변경 7일 쿨다운을 select_campus_school 이 서버에서 강제
  (change_cooldown + next_allowed_at, 새 시즌 시작 시 리셋).
- **알려진 한계 — 버려진 방 즉시 정리 불가**: 두 참가자가 모두 브라우저를
  닫으면 heartbeat/cleanup 호출 주체가 없어 방이 waiting/running 상태로
  남는다. 서버 스케줄러(pg_cron 등) 없이는 즉시 정리가 불가능하므로,
  `cleanup_abandoned_rooms()` RPC(모든 멤버가 45초+ 무응답인 방만 closed,
  1회 10건 제한)를 다음 사용자의 방 생성/입장 시점에 best-effort 로 호출해
  지연 정리한다. 활성 멤버가 한 명이라도 있는 방은 닫히지 않는다.

## 2026-07-27 PHASE B — 라이브 SQL 적용 확인 + Supabase Preview 전환

- 사용자가 20260727 SQL 2건(campus_realtime_v2 → room_presence_cleanup)을
  라이브 Supabase 에 실행 완료.
- anon key 스모크 검증(클라이언트와 동일 권한, 익명 2명): 21/22 PASS —
  시즌 season-15 자동 준비 · 디렉터리 조회 · 원장 직접 SELECT 차단 ·
  커스텀 학교 created/existing/ownership_conflict/name_conflict/invalid ·
  membership selected/unchanged/change_cooldown(+next_allowed_at) ·
  스트레칭 sessionId dedup(eventId 변경해도 duplicate_event) ·
  회복 동시 2건 중 1건만 수락(advisory lock) · my_contribution/standings ·
  cleanup_abandoned_rooms · 비멤버 heartbeat 거부.
  유일한 FAIL 은 `is_room_member` 의 PostgREST 직접 RPC 노출(스키마 캐시)
  — 함수 자체는 DB 에 존재하고 내부 호출(cleanup_stale_members 의 게이트)로
  정상 동작 확인. 클라이언트는 이 함수를 직접 호출하지 않으므로 앱 무영향.
- 스모크가 남긴 라이브 데이터(정리 원하면 SQL 로 삭제 가능):
  익명 사용자 2명, 커스텀 학교 `custom-b0b1e57` "검증테스트대학"(멤버 2),
  season-15 기여 40점(stretch 20 + recovery 20).
- Preview 환경 `VITE_ENABLE_CAMPUS_SUPABASE=true` 로 전환하고 클라우드
  빌드 Preview 재배포. mock(false) Preview 는 더 이상 기본이 아님.
- **배포 방법 주의(재발 방지)**: Vercel env 가 sensitive 로 표시돼 있어
  `vercel pull` 은 `[SENSITIVE]` 플레이스홀더만 받는다. 따라서 로컬
  `vercel build` + `deploy --prebuilt` 는 플레이스홀더가 번들에 박혀
  깨진 배포가 된다(upright-ne01yanto 가 그 사례 — 폐기). 반드시
  `vercel deploy`(클라우드 빌드)를 사용할 것. 소스 업로드에서 로컬 개인
  파일을 제외하기 위해 `.vercelignore` 를 추가했다.
- main 병합·Production 배포·Production 환경변수 변경 없음.

## 2026-07-27 RELEASE FREEZE — v1.1.0-rc.1

### 라이브 Supabase 적용 상태 (재실행 금지)

아래 4개 SQL 은 사용자가 라이브에 실행 완료했다. 다시 실행하지 않는다.

1. `20260726_expand_room_duration.sql`
2. `20260726_room_lifecycle_security.sql`
3. `20260727_campus_realtime_v2.sql`
4. `20260727_room_presence_cleanup.sql`

확인된 라이브 상태: active season `season-15` · Preview
CAMPUS_SUPABASE=true · room heartbeat/stale cleanup · custom school 공유
가입(existing) · 점수 서버 결정 · 원장 직접 SELECT 차단 · 학교 변경
7일 제한 · stretch sessionId 중복 차단.

**PostgREST 캐시 주의**: schema cache 상태에 따라 직접 RPC 목록 반영이
늦을 수 있다. 앱은 `is_room_member` 를 직접 RPC 로 호출하지 않으며
(`cleanup_stale_members` 내부 게이트로 사용), 내부 게이트는 라이브에서
정상 동작을 확인했다.

### 프리즈 중 발견·수정한 P1 — 익명 가입 직후 401 (PGRST303)

- 증상: room-live e2e 가 전체 스위트에서 간헐 실패. 계측 결과 익명
  signup 200 직후 `create_room` 이 **401 PGRST303 "JWT issued at
  future"** — Supabase 내부(GoTrue↔PostgREST) 시계 오차로 발급 직후
  ~1초 창의 토큰이 거부됨. 신규 사용자의 "가입 직후 첫 액션"(방 만들기,
  학교 선택)이 정확히 이 창에 걸리는 실제 제품 결함.
- 수정: `src/lib/supabase/client.ts` 의 클라이언트 fetch 를
  `fetchRetryingClockSkew` 로 교체 — 401+PGRST303 인 경우에만 1.2초 후
  1회 재시도(요청은 실행 전 거부라 재시도 안전, 그 외 오류는 불변).
  회귀 스펙 `src/lib/supabase/clockSkewFetch.spec.ts` 5건 추가.
- 판정 로직·점수·RPC 서명 등 제품 규칙 변경 없음.

### 테스트 플레이크 기록 (재실행으로 덮지 않음)

- unit 1회 이상 실행(39분·35/46 파일·11 errors): 동시 작업으로 인한
  리소스 고갈로 vitest worker 가 실패한 환경 플레이크. 직후 단독
  재실행은 46파일 394/394·51초 clean. 제품 결함 아님.
- e2e `/campus/map` OFF 리다이렉트 1회 실패(21.5분 런): 5초 렌더 타임아웃
  초과였고 실패 스냅샷에 정상 렌더·리다이렉트가 찍혀 있음. 부하 지연
  플레이크로 판정(다른 3개 런 전부 통과). 제품 결함 아님.
- room-live 실패 2회는 위 PGRST303 로 근본 원인 확인 후 코드로 수정.

### 최종 게이트 (v1.1.0-rc.1 기준)

- assets:verify 112 검사·missing 0·broken 0 / lint 에러 0 / typecheck 통과
- unit **399/399** (47 파일 — clockSkewFetch 5건 포함) / build 통과
- e2e **94/94** 단일 클린 런 (room-live 라이브 Supabase 포함, 3.8분)
- campus-live: 기여→점령/방어(서버 점수 결정)→Realtime 구독 수신까지
  라이브 확인. 원장 직접 SELECT 차단·membership 규칙·dedup 라이브 검증은
  PHASE B 스모크 21/22(+is_room_member 내부 게이트 검증) 참조.
- 미커밋 artifacts PNG 는 픽셀 비교 결과 캡처 타이밍(애니메이션 중간
  프레임)·인코딩 차이로 판정 — 승인 baseline(e09c423) 유지, restore 처리.

### Production 환경 감사 (이름만 확인, 값·설정 미변경)

- 존재: VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY ·
  VITE_ENABLE_CAMERA · VITE_ENABLE_FRIEND_ROOM — `[configured]`
- **누락(배포 전 사용자 설정 필요, 의도값)**: VITE_ENABLE_REALTIME=true ·
  VITE_ENABLE_CAMPUS_THEME=true · VITE_ENABLE_CAMPUS_TERRITORY=true ·
  VITE_ENABLE_CAMPUS_SUPABASE=true · VITE_ENABLE_QA_LAB=false
  (미설정 플래그는 코드 기본값 false 로 동작 — 현 Production 은 안정판
  거동 유지 중이며, v1.1 캠퍼스 공개 시점에 위 5개를 넣어야 한다)

### RC 산출물

- 태그: `v1.1.0-rc.1` (integration/v1.1-all-features HEAD)
- RC Preview(항상 최신, Vercel 로그인 필요):
  https://upright-now-suhyunkim1105-2875-suhyunkim1105-2875s-projects.vercel.app
- 스모크 테스트 데이터 정리 SQL 은 완료 보고의 FINAL_SMOKE_CLEANUP_SQL
  (1회용, 마이그레이션 아님 — custom-b0b1e57 관련 데이터만 제거)
- main 병합·Production 배포는 수동 검증(체크리스트 A~G) 승인 후 진행.
