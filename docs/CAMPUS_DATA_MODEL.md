# CAMPUS_DATA_MODEL — 캠퍼스 데이터 모델

버전 1.0 · migration 파일: `supabase/campus_territory_migration.sql`

> ⚠️ 이 SQL 을 **Production Supabase 에 실행하지 마세요.**
> 이 프로토타입은 로컬 mock 저장소로 검증했습니다.
> 적용은 별도 개발/스테이징 프로젝트에서만 하고,
> `VITE_ENABLE_CAMPUS_SUPABASE=true` 도 그 환경에만 넣으세요.

---

## 1. 로컬 저장 (localStorage)

| 키 | 내용 |
| --- | --- |
| `upright-now:campus` | 학교 선택 · 직접 고른 색 · 변경 이력 · 선택한 타일 |
| `upright-now:campus-ledger` | 기여 원장 (eventId/sessionId 중복·상한 판정용) |
| `upright-now:campus-mock` | mock 저장소 상태 (서버 대역) |
| `upright-now:campus-member` | 익명 기여자 식별자 (UUID) |

모두 `upright-now:` 접두사이므로 `설정 → 모든 데이터 삭제` 가 함께 지웁니다.
`resetAllData()` 는 위 키 삭제 + 스토어 초기화 + 원장·식별자 초기화까지 수행합니다.

### 기여 원장 구조

```ts
interface ContributionLedger {
  seenEventIds: string[]                    // 최근 2000건
  seenSessionKeys: string[]                 // `${kind}:${sessionId}`
  dailyTotals: Record<string, number>       // 'YYYY-MM-DD' → 점수
  recoveryBySession: Record<string, number>
  recentEventTimes: number[]                // 1분 창
  lastRecoveryAt: number | null
}
```

원장은 `await` 전에 동기적으로 확정합니다(동시 호출로 상한 우회 방지).
저장소가 준비되지 않아 실패하면 우리가 쓴 값이 그대로일 때만 되돌립니다.

---

## 2. Supabase 테이블

### 2.1 `campus_schools`

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` | text PK | `^[a-z0-9_-]{2,24}$` |
| `name` | text | 학교 이름 (텍스트만) |
| `short_name` | text | 좁은 자리용 |
| `primary_color` | text | `#RRGGBB`. **프로토타입 프리셋** |
| `color_source` | text | `prototype-preset` \| `user-defined` |
| `pattern` | text | `grid/arch/stripe/dots/weave` |
| `is_custom` | boolean | 기타 / 직접 설정 |

공식 로고·마스코트·공식 색상은 저장하지 않습니다.

### 2.2 `campus_seasons`

`id` PK · `name` · `starts_at` · `ends_at` · `status(active|archived)`
활성 시즌은 부분 unique 인덱스로 **최대 1개**.

### 2.3 `campus_memberships`

| 컬럼 | 비고 |
| --- | --- |
| `user_id` uuid PK | `auth.users` (익명 사용자) |
| `school_id` | 현재 학교 |
| `custom_color` | 기타 학교의 사용자 색 |
| `last_changed_season_id` / `changes_in_season` / `last_changed_at` | 변경 제한 |

재학 인증 정보가 아닙니다. 사용자가 직접 고른 비공식 테마 값입니다.

### 2.4 `campus_tiles`

`id`(= `{season}:{x}-{y}`) · `season_id` · `x(0..11)` · `y(0..7)` · `zone` ·
`owner_school_id` · `challenger_school_id` · `defense_score` · `challenge_score` · `updated_at`

제약: `unique(season_id, x, y)`, challenger ≠ owner.

### 2.5 `campus_contributions`

| 컬럼 | 비고 |
| --- | --- |
| `event_id` text PK | 클라이언트가 만드는 결정적 id → **멱등성** |
| `season_id` · `school_id` · `user_id` | 기여 당시 학교로 고정 |
| `kind` | 4종만 허용 |
| `session_id` | 세션 중복 차단 키 |
| `tile_id` | 반영 대상 |
| `points` | 0..100, **서버가 계산** |

부분 unique 인덱스:
`(season_id, user_id, kind, session_id) where session_id is not null and kind in ('session_completed','friend_session_completed')`

**이 테이블에는 자세 점수·좌표·`bad` 상태·카메라 데이터 컬럼이 없습니다.**

### 2.6 `campus_tile_events`

`id` uuid PK · `season_id` · `tile_id` · `kind(captured|contested|reinforced)` ·
`from_school_id` · `to_school_id` · `created_at`

---

## 3. RPC

| 함수 | 권한 | 역할 |
| --- | --- | --- |
| `campus_set_school(school_id, custom_color)` | authenticated | 학교 선택·변경 (시즌 1회 + 7일) |
| `campus_record_contribution(event_id, season_id, school_id, tile_id, kind, session_id)` | authenticated | **원자적 기여 반영** + 악용 방지 + 점령 판정 |
| `campus_capture_tile(tile_id, school_id, points)` | **회수됨** | 원자적 타일 점령 (`FOR UPDATE`). 내부에서만 호출 |
| `campus_season_standings(season_id)` | authenticated, anon | 학교별 총 기여도·참여자·보정 점수 |
| `campus_my_contribution(season_id)` | authenticated | 현재 학교의 내 기여도 |
| `campus_seed_season(...)` / `campus_archive_season(...)` | **회수됨** | 관리 전용 |

`campus_capture_tile` 은 `public/anon/authenticated` 에서 EXECUTE 를 회수했습니다.
`campus_record_contribution` 이 security definer 로 소유자 권한으로 호출합니다
→ 클라이언트가 임의 점령을 만들 수 없습니다.

---

## 4. RLS

| 테이블 | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- |
| `campus_schools` | 전체 (authenticated, anon) | 정책 없음 |
| `campus_seasons` | 전체 | 정책 없음 |
| `campus_tiles` | 전체 (지도는 공개) | 정책 없음 → RPC 만 |
| `campus_tile_events` | 전체 | 정책 없음 → RPC 만 |
| `campus_memberships` | **본인 행만** | 정책 없음 → RPC 만 |
| `campus_contributions` | **본인 행만** | 정책 없음 → RPC 만 |

- 모든 테이블 `enable row level security`.
- 쓰기 정책이 아예 없으므로 **다른 학교 데이터·다른 사람 기여를 직접 수정할 수 없습니다.**
- 두 번째 방어선: Supabase 가 public 스키마 새 테이블에 기본 grant 하는
  `INSERT/UPDATE/DELETE/TRUNCATE` 를 `anon`·`authenticated` 에서 **회수**했습니다.
  나중에 허용 정책이 실수로 추가되어도 쓰기가 열리지 않습니다.
  `campus_memberships`·`campus_contributions` 의 `SELECT` 는 `anon` 에서도 회수했습니다.
- `campus_record_contribution` 은 `p_school_id` 가 내 membership 과 다르면 거절합니다
  (`school_mismatch`).
- 다른 사람의 기여 이력·소속은 조회할 수 없습니다. 집계만 security definer RPC 로 공개합니다.

---

## 5. 개인정보 경계

저장·전송하지 않는 것:

- 카메라 영상·사진·스냅샷·프레임
- 프레임별 랜드마크 원본, 자세 좌표, 편차 수치
- `bad` 자세 상태, 나쁜 자세 시간, 건강 정보
- 자세 점수 (기여도 계산에 아예 쓰지 않습니다)

전송하는 것: 학교 id · 시즌 id · 타일 id · 기여 종류 · 세션 id · 점수 · 익명 사용자 id.

검증:
- `mockRepository.spec.ts` — 저장 JSON 에 금지 키 0건
- `e2e/campus.spec.ts` — 브라우저 localStorage 의 campus 키에 금지 키 0건

---

## 6. mock → Supabase 교체 절차

1. 개발/스테이징 Supabase 프로젝트에서 `campus_territory_migration.sql` 실행.
2. 첫 시즌 생성:
   `select public.campus_seed_season('season-1','시즌 1', now(), now() + interval '14 days');`
3. 그 환경의 env 에만 추가:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   VITE_ENABLE_CAMPUS_THEME=true
   VITE_ENABLE_CAMPUS_TERRITORY=true
   VITE_ENABLE_CAMPUS_SUPABASE=true
   ```
4. `campusStore.createRepository()` 가 자동으로 `SupabaseCampusRepository` 를 씁니다.
   화면 코드는 한 줄도 바뀌지 않습니다.
5. 시즌 종료 배치: `campus_archive_season(<id>)` → `campus_seed_season(<다음 id>, ...)`.
   (지금은 mock 이 14일 주기로 자동 롤오버합니다)
