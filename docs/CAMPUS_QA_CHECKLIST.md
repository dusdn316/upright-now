# CAMPUS_QA_CHECKLIST — 캠퍼스 테마·영토전 QA

버전 1.0 · 브랜치 `feat/campus-territory-prototype`

---

## 0. 실행 명령

```bash
npm install
npm run lint        # oxlint — error 0
npm run typecheck   # tsc -b --force
npm run test        # vitest — 263 tests
npm run test:e2e    # playwright chromium — 서버 2대 (5283 OFF / 5284 ON)
npm run build       # tsc + vite build
```

E2E 는 dev 서버 2대를 띄웁니다.

| 포트 | 플래그 | 검사 |
| --- | --- | --- |
| 5283 | 캠퍼스 OFF | 기존 화면 회귀 + OFF 회귀 (`campus-off.spec.ts`) |
| 5284 | 캠퍼스 ON (mock) | 캠퍼스 테마·영토전 (`campus.spec.ts`) |

> 포트를 5273/5274 → 5283/5284 로 옮겼습니다.
> 다른 프로젝트 디렉터리의 dev 서버가 5273 을 점유해 충돌했기 때문입니다.

---

## 1. 기능 플래그

| # | 항목 | 방법 | 기대 | 자동화 |
| --- | --- | --- | --- | --- |
| 1-1 | 기본값이 false | `.env` 없이 실행 | 캠퍼스 메뉴·화면·배지 없음 | `flags.spec.ts` |
| 1-2 | OFF 에서 기존 앱 동일 | 5283 전체 e2e | 기존 93개 검사 통과 | `npm run test:e2e` |
| 1-3 | OFF 에서 `/campus` 직접 진입 | 주소 입력 | 404 없이 홈으로 | `campus-off.spec.ts` |
| 1-4 | OFF 에서 설정에 학교 선택 없음 | `/settings` | 카드 없음 | `campus-off.spec.ts` |
| 1-5 | OFF 에서 CSS 변수·mock 키 없음 | devtools | `--campus-*` 없음, `campus*` 키 0개 | `campus-off.spec.ts` |
| 1-6 | OFF 에서 캠퍼스 dev API 미설치 | `window.__uprightCampus` | `undefined` | `campus-off.spec.ts` |
| 1-7 | 테마만 ON | `VITE_ENABLE_CAMPUS_THEME=true` | 학교 선택 노출, `/campus` 라우트 없음 | `flags.spec.ts` |

---

## 2. 캠퍼스 테마

| # | 항목 | 기대 | 자동화 |
| --- | --- | --- | --- |
| 2-1 | 학교 11개 (1차 10 + 기타) | 목록 마지막이 `기타 / 직접 설정` | `theme.spec.ts` |
| 2-2 | 고지 문구 노출 | `사용자가 직접 선택한 비공식 캠퍼스 테마입니다.` | `campusScreens.spec.tsx`, `campus.spec.ts` |
| 2-3 | 색 출처 표시 | `프로토타입이 임의로 고른 컬러 프리셋` | `campusScreens.spec.tsx` |
| 2-4 | 공식 색상 주장 없음 | 어디에도 "공식 색상이에요/입니다" 없음 | 두 spec 의 금지 문구 검사 |
| 2-5 | 기타 학교 색 직접 선택 | 팔레트 8색 + HEX 입력 | `campusScreens.spec.tsx` |
| 2-6 | 잘못된 HEX | 안내 문구, 색 미변경 | `theme.spec.ts` (정규화) |
| 2-7 | CSS 변수 주입 | `--campus-primary` = 학교 색 | `campusScreens.spec.tsx` |
| 2-8 | 사이드바 선택 색 | 활성 항목이 학교 soft/deep | 수동 |
| 2-9 | 프로필 학교 배지 | 사이드바 프로필 아래 표시 | `campusScreens.spec.tsx` |
| 2-10 | 친구 방 상단 배너 | `/room/:code` 에 배너 | 수동 (친구 방 플래그 필요) |
| 2-11 | 결과 공유 카드 테두리 | `campus-share-frame` + 배지 | `campusScreens.spec.tsx` |
| 2-12 | 과잠 기본 색·백팩 테마 | 캐릭터 배지 색이 학교 색 | 수동 |
| 2-13 | 도서관 배경 패턴 | `/campus` 카드 뒤 패턴 | 수동 |
| 2-14 | 시험기간 배경 | 시즌 종료 3일 이내에 배지+진한 패턴 | 수동 |
| 2-15 | 배지 대비 4.5:1 | 전체 프리셋 통과 | `theme.spec.ts` |
| 2-16 | 자세 상태 색 유지 | good/warning/bad 색이 학교 색으로 안 바뀜 | 수동 |

---

## 3. 기여도

| # | 항목 | 기대 | 자동화 |
| --- | --- | --- | --- |
| 3-1 | 정상 완료 세션 | +100 | `contribution.spec.ts`, `campus.spec.ts` |
| 3-2 | 자세 회복 성공 | +20 | `contribution.spec.ts` |
| 3-3 | 친구 세션 완주 | +50 (완료 100과 별개) | `recordContribution.spec.ts` |
| 3-4 | 스트레칭 완주 | +20 | `contribution.spec.ts` |
| 3-5 | 자세 점수 미사용 | 기여 이벤트에 점수 필드 없음 | 타입·`mockRepository.spec.ts` |
| 3-6 | 미완료/중도 종료 | 0점 | `campus.spec.ts` |
| 3-7 | 데모(`?demo=1`)·QA Lab | 0점 | `recordContribution.spec.ts`, `campus.spec.ts` |
| 3-8 | eventId 중복 | 두 번째 거절 | 3곳(원장/저장소/e2e) |
| 3-9 | sessionId 중복 | eventId 달라도 1회 | `contribution.spec.ts`, `recordContribution.spec.ts` |
| 3-10 | 하루 600점 상한 | 부분 적립 후 거절, 다음 날 초기화 | `contribution.spec.ts` |
| 3-11 | 회복 세션당 5회 | 6회째 거절 | `contribution.spec.ts` |
| 3-12 | 회복 20초 간격 | 연속 호출 거절 | `contribution.spec.ts`, `campus.spec.ts` |
| 3-13 | 1분 12건 제한 | 초과분 거절 | `contribution.spec.ts` |
| 3-14 | 학교 변경 후 기여 이동 금지 | 새 학교 기준 0점, 이전 학교에 남음 | `mockRepository.spec.ts`, `recordContribution.spec.ts` |
| 3-15 | 로컬 원장 삭제 우회 | 저장소가 eventId 기억 → 거절 | `recordContribution.spec.ts` |
| 3-16 | 규모 보정 | 큰 학교가 총량으로 앞서도 순위 역전 가능 | `contribution.spec.ts` |
| 3-17 | 공식 순위 표현 없음 | `실제 공식 순위가 아니에요` 노출 | 금지 문구 검사 |

---

## 4. 영토 점령

| # | 항목 | 기대 | 자동화 |
| --- | --- | --- | --- |
| 4-1 | 12×8 = 96 타일 | 96개 | `territory.spec.ts`, e2e |
| 4-2 | 5개 구역 존재 | 도서관/광장/강의동/잔디밭/카페 | `territory.spec.ts` |
| 4-3 | 공격 > 방어 → 점령 | owner 교체 | `territory.spec.ts` |
| 4-4 | 넘친 점수 carry | 새 방어 점수로 이어짐 | `territory.spec.ts` |
| 4-5 | 내 학교 = 방어 보강 | defense 증가 | `territory.spec.ts` |
| 4-6 | 80% 이상 → 경합 표시 | 점선 + 진행 바 + aria-label | `territory.spec.ts` |
| 4-7 | 경합 이벤트 1회 | 상태 전환 시에만 로그 | `territory.spec.ts` |
| 4-8 | 다른 학교 공격 밀어내기 | challenger 교체 | `territory.spec.ts` |
| 4-9 | 점령 색상 변화 애니메이션 | `.anim-campus-capture` 700ms 1회 | 수동 |
| 4-10 | 두 탭 실시간 반영 | 새로고침 없이 owner 변경 | `campus.spec.ts` |
| 4-11 | 시즌 종료 보관 | `/campus/history` 에 최종 지도 | 수동 (14일) / `mockRepository` 롤오버 코드 |
| 4-12 | 새 시즌 초기화 | 전부 중립 | `territory.spec.ts` |

---

## 5. 레이아웃

| 폭 | `/` | `/settings` | `/campus` | `/campus/map` | `/campus/history` |
| --- | --- | --- | --- | --- | --- |
| 1440 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1280 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1024 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 768 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 390 | ⚠️ 396px | ⚠️ | ⚠️ | ✅ | ✅ |

- **요구사항인 1280 × 800 과 1440 × 1000 에서 가로 스크롤 0** 입니다. (자동화됨)
- 640px 미만은 `AppShell` 의 고정 사이드바(232px)+본문 패딩(48px) 때문에
  **캠퍼스 이전부터** 가로 스크롤이 남아 있습니다. (`/` 396px, `/room/new` 437px)
  캠퍼스 화면도 같은 제약을 받으며, 이번 작업 범위에서 사이드바 구조는 바꾸지 않았습니다.
  → `CAMPUS_DECISIONS_NEEDED.md` D-6

이번 작업에서 고친 축소(shrink) 문제:
- 암시적 `grid` 열이 콘텐츠 폭으로 커지던 곳에 `grid-cols-1` 명시
- 학교별 기여도 표를 `min-w-0 overflow-x-auto` 안에서만 가로 스크롤
- `PageHeader` 에 `flex-wrap` + 제목 블록 `min-w-0`

---

## 6. 접근성

| # | 항목 | 상태 |
| --- | --- | --- |
| 6-1 | 학교 선택이 네이티브 radio 그룹 | ✅ |
| 6-2 | 지도가 `fieldset` + `sr-only legend` | ✅ |
| 6-3 | 타일 `aria-label` 에 구역·점령 학교·진행도 | ✅ |
| 6-4 | 읽기 전용 지도는 Tab 순서에서 제외 (`tabIndex=-1`) | ✅ |
| 6-5 | 색 외 신호 (★, 점선, 진행 바, 텍스트) | ✅ |
| 6-6 | 표에 `caption`(sr-only) | ✅ |
| 6-7 | 진행도는 네이티브 `<progress>` | ✅ |
| 6-8 | 오류 안내가 `<output>` | ✅ |
| 6-9 | 배지 대비 4.5:1 이상 | ✅ 자동 검사 |
| 6-10 | `prefers-reduced-motion` 준수 | ✅ (전역 규칙 사용) |

---

## 7. 개인정보

| # | 항목 | 상태 |
| --- | --- | --- |
| 7-1 | 카메라·프레임·랜드마크 저장 0건 | ✅ 자동 검사 |
| 7-2 | 자세 좌표·편차 저장 0건 | ✅ 자동 검사 |
| 7-3 | `bad` 상태 저장 0건 | ✅ 자동 검사 |
| 7-4 | 자세 점수 기여도 미사용 | ✅ 타입 수준 |
| 7-5 | 회원가입 요구 없음 (익명) | ✅ |
| 7-6 | 다른 사람 기여 이력 조회 불가 | ✅ RLS |
| 7-7 | 모든 데이터 삭제가 캠퍼스 값 포함 | ✅ `recordContribution.spec.ts` |

---

## 8. 문구

금지 문구 자동 검사 (`campusScreens.spec.tsx`, `campus.spec.ts`):

```
공식 대항전이에요 / 공식 대항전입니다
공식 순위예요 / 공식 순위입니다
공식 색상이에요 / 공식 색상입니다
대학 인증 완료
학교를 대표해요 / 학교 대표로
```

필수 노출 문구:

- `사용자가 직접 선택한 비공식 캠퍼스 테마입니다.`
- `대학 인증이 없는 비공식 게임형 프로토타입이에요.`
- `색은 이 프로토타입이 임의로 고른 컬러 프리셋이에요. 공식 색상이 아니에요.`
- `실제 공식 순위가 아니에요.`
- `학교를 바꿔도 이전 학교에 쌓인 기여도는 옮겨지지 않아요.`

---

## 9. 수동 확인 순서 (Preview)

1. Preview 에 `VITE_ENABLE_CAMPUS_THEME=true`, `VITE_ENABLE_CAMPUS_TERRITORY=true` 만 넣습니다.
   (`VITE_ENABLE_CAMPUS_SUPABASE` 는 넣지 않습니다 → mock)
2. `/settings` → 학교 선택. 고지 문구·색 출처 확인.
3. 사이드바 선택 색·프로필 배지 확인.
4. `/campus` → 지도·시즌 남은 시간·최근 점령 로그·학교별 기여도 확인.
5. `/campus/map` → 타일 클릭 → 상세 → `기여 대상으로 설정`.
6. 같은 브라우저에서 `/campus/map` 을 새 탭으로 하나 더 엽니다.
7. 한쪽에서 세션을 시작하고 완료 → 다른 탭 지도가 즉시 갱신되는지 확인.
8. `/settings` 에서 학교를 한 번 더 바꿔 보고 **변경 제한** 안내가 뜨는지 확인.
9. `/campus/history` → 이번 시즌 영토 변화.
10. 1280 × 800 / 1440 × 1000 창 크기에서 가로 스크롤 없음 확인.
