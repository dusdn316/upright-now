# CAMPUS_THEME_SPEC — 캠퍼스 테마

버전 1.0 · 브랜치 `feat/campus-territory-prototype`

---

## 0. 한 줄 요약

사용자가 직접 고른 학교에 따라 앱의 **표시 색과 배경 패턴만** 바뀝니다.
자세 판정·XP·보상량·괴물 HP·친구 방 성능은 **전혀 바뀌지 않습니다.**

---

## 1. 전제와 고지

- 대학 인증(재학 확인)이 **없습니다.**
- 화면에 그대로 노출하는 문구: **"사용자가 직접 선택한 비공식 캠퍼스 테마입니다."**
  - 구현 위치: `src/components/campus/SchoolPicker.tsx` (`data-testid="campus-unofficial-line"`)
  - 문구 상수: `CAMPUS_COPY.unofficialTheme` (`src/constants/campus.ts`)
- 학교 **공식 로고·마스코트·엠블럼을 사용하지 않습니다.** 학교 이름 텍스트와
  일반적인 기하 패턴(격자/아치/사선/점/직조)만 사용합니다.
- 색은 **프로토타입 컬러 프리셋**입니다. 코드에 공식 색상 출처가 없으므로
  어디에서도 "공식 색상"이라고 표시하지 않습니다.
  - 각 학교 레코드에 `colorSource: 'prototype-preset'` 이 붙고, 화면에는
    `색은 이 프로토타입이 임의로 고른 컬러 프리셋이에요. 공식 색상이 아니에요.` 가 나옵니다.

---

## 2. 1차 학교 목록

| id | 이름 | 프리셋 색 | 색 이름(프리셋) | 패턴 |
| --- | --- | --- | --- | --- |
| `snu` | 서울대학교 | `#2B4C7E` | 딥 네이비 | 아치 |
| `yonsei` | 연세대학교 | `#1D4E89` | 딥 블루 | 격자 |
| `korea` | 고려대학교 | `#8E2438` | 딥 크림슨 | 사선 |
| `sogang` | 서강대학교 | `#A24936` | 브릭 레드 | 직조 |
| `skku` | 성균관대학교 | `#1E6B5E` | 딥 그린 | 아치 |
| `hanyang` | 한양대학교 | `#2F4F82` | 인디고 블루 | 격자 |
| `cau` | 중앙대학교 | `#39609E` | 스틸 블루 | 사선 |
| `khu` | 경희대학교 | `#22603C` | 포레스트 그린 | 직조 |
| `hufs` | 한국외국어대학교 | `#2C6E7F` | 틸 블루 | 점 |
| `uos` | 서울시립대학교 | `#4A5CA8` | 바이올렛 블루 | 점 |
| `custom` | 기타 / 직접 설정 | 사용자 선택 | 직접 고른 색 | 격자 |

- 목록은 항상 `기타 / 직접 설정` 이 마지막입니다.
- `기타` 를 고르면 8색 팔레트 + HEX 직접 입력으로 색을 정합니다.
  이때 `colorSource: 'user-defined'` 로 표시됩니다.
- 색 변경은 **학교 변경이 아닙니다.** 변경 제한을 소모하지 않습니다.

---

## 3. 테마가 바꾸는 것

`resolveCampusTheme(schoolId, customColor)` 가 만든 토큰을
`CampusThemeRoot` 가 `document.documentElement` 에 CSS 변수로 주입합니다.

| 토큰 | 뜻 |
| --- | --- |
| `--campus-primary` | 메인 포인트 색 |
| `--campus-soft` | 아주 연한 배경 (primary 10% + canvas) |
| `--campus-soft-strong` | 연한 배경·경계 (primary 22% + canvas) |
| `--campus-on-primary` | primary 위 글자색 (대비 자동 선택) |
| `--campus-deep` | 밝은 색을 골랐을 때의 어두운 파생색 |

적용 지점:

| # | 지점 | 구현 |
| --- | --- | --- |
| 1 | 메인 포인트 색 | `--campus-primary` (배지·배너·타일·테두리) |
| 2 | 사이드바 선택 색 | `SidebarNavigation` 의 `NavLink style` (활성 항목만) |
| 3 | 프로필 학교 배지 | `CampusProfileBadge` (사이드바 프로필 아래) |
| 4 | 친구 방 상단 배너 | `CampusRoomBanner` (`/room/:code` 헤더 아래) |
| 5 | 결과 공유 카드 테두리 | `CampusShareCardFrame` (`/result/:id` 보상 카드) |
| 6 | 과잠 기본 색 | `CharacterWithGear` — 학교 색으로 표시 |
| 7 | 캠퍼스 백팩 테마 | `CharacterWithGear` — 백팩 배지 테두리·아이콘 색 |
| 8 | 도서관 배경 패턴 | `CampusBackdrop kind="library"` (캠퍼스/지도 화면) |
| 9 | 시험기간 배경 | `CampusBackdrop kind="exam"` (시즌 종료 3일 이내) |

패턴 CSS: `src/index.css` 의 `.campus-pattern--{grid,arch,stripe,dots,weave}`
`시험기간` 은 같은 패턴을 더 진하게 쓰고 경고색 사선 띠를 겹칩니다.
`prefers-reduced-motion` 을 지키며 반복 애니메이션은 두지 않습니다.

---

## 4. 절대 바꾸지 않는 것

- 자세 판정 (`features/posture-engine/*`)
- 캘리브레이션 (`features/calibration/*`)
- XP·잎사귀 포인트·보상량 (`features/game/rewards.ts`, `constants/game.ts`)
- 괴물 HP·피해량 (`features/game/*`, `constants/game.ts`)
- 친구 방 연결·Presence·Broadcast·성능 (`features/rooms/*`)
- PiP (`features/pip/*`)
- 자세 상태 색(good/warning/bad)은 캠퍼스 색으로 **덮어쓰지 않습니다.**

과잠·백팩은 **표시 색만** 학교 색을 따릅니다. 가격·구매·장착 로직은 그대로입니다.

---

## 5. 접근성

- 배지 글자색은 흰색/먹색 중 대비가 높은 쪽을 계산해서 고릅니다.
  전체 학교 프리셋이 **대비 4.5:1 이상**임을 `theme.spec.ts` 가 검사합니다.
- 색만으로 정보를 전달하지 않습니다.
  - 내 학교 영토: 색 + `★`
  - 경합 타일: 색 + 점선 테두리 + 하단 진행 바 + `aria-label`
- 학교 선택은 네이티브 `<input type="radio">` 그룹입니다 (키보드 좌우 이동 지원).
- 배지에는 `sr-only` 로 `— {학교 이름} · 비공식 캠퍼스 테마` 가 붙습니다.

---

## 6. 기능 플래그

```
VITE_ENABLE_CAMPUS_THEME=false      # 기본값
VITE_ENABLE_CAMPUS_TERRITORY=false  # 기본값
```

- `campusSchoolPicker = campusTheme || campusTerritory`
  → 둘 중 하나라도 켜지면 설정에 학교 선택이 나옵니다.
- 둘 다 꺼지면 CSS 변수 주입·배지·배너·테두리·패턴이 **전부 렌더되지 않고**
  기존 앱과 완전히 동일합니다. (`campusFlagOff.spec.tsx`, `e2e/campus-off.spec.ts`)

---

## 7. 저장 항목 (`upright-now:campus`)

```ts
{
  schoolId: string | null
  customColor: string        // #RRGGBB
  lastChangedAt: number | null
  lastChangedSeasonId: string | null
  changesInSeason: number
  targetTileId: string | null
}
```

카메라·프레임·랜드마크·자세 좌표·`bad` 상태는 들어가지 않습니다.
`설정 → 모든 데이터 삭제` 가 이 키와 기여 원장·익명 식별자까지 지웁니다.
