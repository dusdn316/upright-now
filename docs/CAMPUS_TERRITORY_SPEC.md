# CAMPUS_TERRITORY_SPEC — 캠퍼스 영토전 프로토타입

버전 1.0 · 브랜치 `feat/campus-territory-prototype`

---

## 0. 성격

- **비공식 게임형 프로토타입**입니다. 공식 대항전이 아닙니다.
- 대학 인증이 없습니다. 사용자가 학교를 직접 고릅니다.
- 지금은 **로컬 프로토타입 + mock data** 로 동작합니다.
  (Supabase 저장소 구현은 있지만 기본으로 꺼져 있습니다)
- 순위는 **공식 순위가 아닙니다.** 화면에도 그렇게 적습니다.

---

## 1. 가상 캠퍼스 지도

- 자체 제작 **12 × 8 = 96 타일**. 실제 서울 지도나 특정 학교 부지를 복제하지 않습니다.
- 좌표는 순수한 격자이며 지리 정보가 아닙니다.

구역 배치 (`src/features/campus/campusMap.ts`)

```
y=0..1   강의동  (x 0..11)
y=2..4   도서관(x 0..4) | 광장(x 5..8) | 카페(x 9..11)
y=5..7   잔디밭  (x 0..11)
```

| 구역 | 기본 방어 점수 | 성격 |
| --- | --- | --- |
| 도서관 | 240 | 가장 단단함 |
| 광장 | 200 | 중앙 경합 |
| 강의동 | 180 | 보통 |
| 카페 | 140 | 약함 |
| 잔디밭 | 120 | 가장 쉽게 바뀜 |

화면에 표시하는 것: 현재 점령 학교 · 점령 진행도 · 최근 영토 변화 ·
시즌 남은 시간 · 내 학교 기여도.

---

## 2. 시즌

- 길이 **14일** 고정. 기준 시각 `2026-01-05 UTC` 에서 시즌 번호를 계산합니다.
  (`seasonAt(now)` — 서버 없이도 "남은 시간"과 "종료 → 초기화"를 확인할 수 있게)
- 시즌 종료 시 최종 지도를 `archived` 로 보관하고 (`/campus/history`),
  새 시즌 지도는 전부 중립으로 **초기화**됩니다.
- Supabase 로 옮기면 `campus_seasons` 행이 이 계산을 대체합니다.

---

## 3. 기여도

### 3.1 이벤트와 점수

**자세 점수는 쓰지 않습니다.** "성공했다는 사실"만 씁니다.

| 이벤트 | 점수 | 관찰 지점 |
| --- | --- | --- |
| 정상 완료 세션 | **+100** | `sessionStore.status → 'completed'` |
| 자세 회복 성공 | **+20** | `postureStore.lastEvent.type === 'recovery_succeeded'` |
| 친구 세션 완주 | **+50** | 위 완료 세션이 `mode === 'room'` 일 때 추가 |
| 스트레칭 완주 | **+20** | `Stretch` 화면의 완료 시점 |

- 친구 방 세션을 완주하면 `정상 완료(100)` + `친구 완주(50)` = **150** 이 됩니다.
  (서로 다른 이벤트 종류이며 각각 세션당 1회입니다)
- **중도 종료 · 데모 · QA 는 기여도가 없습니다.**
  - 중도 종료: `status === 'aborted'` 는 관찰하지 않습니다.
  - 데모/QA: `/lab` 과 `?demo=1` 은 데모 모드를 켜므로 `isDemo` 가드에서 걸립니다.

### 3.2 관찰 방식 (코어 무변경)

`CampusContributionBridge` 가 기존 스토어를 **읽기만** 합니다.
자세 엔진·보상·세션 코어 파일을 고치지 않습니다.
스트레칭만 화면에서 완료 시점을 알 수 있는 유일한 지점이라
`src/app/routes/Stretch.tsx` 에서 플래그 가드와 함께 3줄을 호출합니다.
(보상 계산에는 어떤 영향도 주지 않습니다)

### 3.3 악용 방지

| 장치 | 값 | 구현 |
| --- | --- | --- |
| eventId 중복 차단 | — | 로컬 원장 `seenEventIds` + 저장소 `processedEventIds` / SQL `event_id` PK |
| sessionId 중복 차단 | 완주 계열 세션당 1회 | 원장 `seenSessionKeys` / SQL 부분 unique 인덱스 |
| 하루 최대 기여도 | **600점** | 로컬 날짜 / SQL Asia/Seoul 기준 |
| 회복 기여 세션당 상한 | **5회** | `recoveryBySession` / SQL count |
| 회복 최소 간격 | **20초** | `lastRecoveryAt` / SQL `now() - max(created_at)` |
| 과도한 이벤트 제한 | **12건 / 1분** | `recentEventTimes` / SQL count |
| 학교 변경 후 기여 이동 금지 | — | 기여 행이 당시 `schoolId` 로 고정. 내 기여도는 `(schoolId, memberId)` 키로 조회 |
| 로컬 원장 삭제로 이중 계산 금지 | — | 저장소가 `eventId` 를 기억 (테스트로 검증) |

하루 상한에 걸리면 **남은 만큼만** 인정하고(부분 적립) 그 뒤로는 거절합니다.
점수는 서버 RPC 가 `kind` 로부터 다시 계산합니다. 클라이언트 값을 믿지 않습니다.

### 3.4 규모 보정

```
normalizedScore = totalContribution / sqrt(max(activeContributors, 1))
```

- 총 기여도와 보정 점수를 **함께** 보여 줍니다.
- 정렬은 보정 점수 내림차순 → 총 기여도 → 학교 id.
- 큰 학교가 총량으로 앞서도 보정 점수에서는 뒤집힐 수 있습니다.
  (`contribution.spec.ts` 의 `big`(10,000/400명) vs `small`(3,000/20명) 케이스)
- 화면 문구: `규모 보정 점수는 총 기여도를 참여자 수의 제곱근으로 나눈 값이에요. 실제 공식 순위가 아니에요.`

---

## 4. 영토 점령

각 타일: `ownerSchoolId` · `challengerSchoolId` · `defenseScore` ·
`challengeScore` · `updatedAt` · `seasonId`

규칙 (`applyContributionToTile`, SQL `campus_capture_tile`)

1. **내 학교가 owner** → `defenseScore += points` (방어 보강)
2. **challenger 없음 또는 내 학교** → `challengeScore += points`
3. **다른 학교가 공격 중** → 그 공격 점수를 깎고, 0 이하가 되면 내가 공격자
4. **`challengeScore > defenseScore`** → 점령
   - 새 owner = 공격자, challenger 비움, `challengeScore = 0`
   - 넘친 점수는 새 owner 의 `defenseScore` 로 이어집니다 (최소 1)
5. **`challengeScore / defenseScore >= 0.8`** → 지도에 **경합** 상태 표시
   - 색 + 점선 테두리 + 진행 바 + `aria-label` 로 함께 알립니다
   - 경합 이벤트는 상태가 처음 바뀔 때만 로그에 남습니다
6. 점령 순간 색상 변화 애니메이션 (`.anim-campus-capture`, 700ms, 1회)

타일 이벤트 종류는 `captured` · `contested` · `reinforced` 입니다.
`/campus` 의 **최근 점령 로그**는 `captured`·`contested` 만 보여 줍니다.
방어 보강이 잦아 점령 기록을 밀어내 보이지 않게 되는 것을 막기 위한 필터이며,
전체 기록은 `/campus/map` 과 `/campus/history` 의 **최근 영토 변화**에서 봅니다.

기여를 넣을 타일은 ① 사용자가 지도에서 고른 타일 ② 내가 이미 공격 중인 타일 중
진행도가 가장 높은 것 ③ 가장 약한 남/중립 타일 순으로 결정됩니다.

---

## 5. 실시간

### mock (기본)

- 같은 브라우저의 다른 탭 → `BroadcastChannel('upright-now:campus-mock')`
- 같은 JS 컨텍스트의 다른 인스턴스 → 모듈 내 리스너
- 스냅샷 전체를 전파하고, owner 가 바뀐 타일에 색상 변화 애니메이션을 트립니다.
- **쓰기 직렬화**: 기여 반영은 `read-modify-write` 전체를
  Web Locks(`navigator.locks.request`)로 감싸고, 상태를 **localStorage 에서 다시 읽어**
  적용합니다. 메모리 캐시만 믿지 않으므로 다른 탭의 갱신을 덮어쓰지 않습니다.
  (`mockRepository.spec.ts` 의 "다른 탭이 먼저 쓴 갱신을 덮어쓰지 않는다")
- Web Locks 를 지원하지 않는 환경에서는 잠금 없이 진행합니다.
  같은 탭 안에서는 JS 가 순차 실행이라 유실이 없고, 탭 간에는 아주 좁은 창이 남습니다.

### Supabase (선택)

- `campus_tiles` / `campus_tile_events` 를 `supabase_realtime` publication 에 추가.
- 변경 알림 → 스냅샷 재조회.
- 점수 적용은 `FOR UPDATE` 행 잠금 RPC 이므로 동시 호출에도 유실이 없습니다.

---

## 6. 학교 변경 제한

- **시즌 중 1회**, 그리고 **마지막 변경으로부터 7일 뒤**.
  둘을 모두 만족해야 하므로 다음 변경 가능 시점은
  `max(시즌 종료, 마지막 변경 + 7일)` 입니다.
- **첫 선택은 변경이 아닙니다** (제한을 소모하지 않습니다).
- `기타` 학교의 색만 바꾸는 것은 변경이 아닙니다.
- 잠긴 동안 다른 학교 라디오는 `disabled` 가 되고 이유·다음 가능 시각을 보여 줍니다.
- 학교를 바꾸면 이전 학교 기여도는 **옮겨지지 않고 그 학교에 남습니다.**
  선택한 타일(`targetTileId`)도 함께 버립니다.
- 서버 측은 `campus_set_school` RPC 가 같은 규칙을 강제합니다.
  (로컬 저장소를 지워 우회하는 것을 막는 최종 방어선)

---

## 7. 화면

| 주소 | 내용 |
| --- | --- |
| `/campus` | 내 학교 · 이번 시즌 · 점령 타일 수 · 내 기여도 · 실시간 지도 · 최근 점령 로그 · 학교별 기여도 · 학교 변경 안내 · 비공식 안내 |
| `/campus/map` | 큰 지도 · 타일 상세(점령 학교/도전 학교/방어·공격 점수/진행도) · 기여 대상 지정 · 구역별 내 영토 · 시험기간 배경 |
| `/campus/history` | 이번 시즌 영토 변화 전체 · 지난 시즌 최종 지도와 학교별 기여도 |
| `/settings` | 학교 선택 (플래그 ON일 때만) |
| `/` | 대시보드 캠퍼스 카드 (점령/내 기여/시즌 남은 시간) |

플래그가 꺼지면 라우트를 **등록하지 않습니다.** 주소로 직접 들어오면
기존 `*` 규칙이 홈으로 보냅니다 (404 없음).

---

## 8. 저장소 교체

```ts
interface CampusRepository {
  readonly kind: 'mock' | 'supabase'
  load(): Promise<CampusSnapshot>
  subscribe(listener: (s: CampusSnapshot) => void): () => void
  submitContribution(event: CampusContributionEvent): Promise<CampusSubmitResult>
  dispose(): void
}
```

화면과 스토어는 이 인터페이스만 씁니다.
`VITE_ENABLE_CAMPUS_SUPABASE=true` + Supabase env 가 모두 있을 때만
`SupabaseCampusRepository` 를 쓰고, 실패하면 mock 으로 내려앉습니다.
Preview·E2E 는 항상 mock 입니다.
