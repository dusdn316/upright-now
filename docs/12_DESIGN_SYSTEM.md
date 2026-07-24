# DESIGN SYSTEM

## 1. 디자인 콘셉트

> **Playful Pastel Dashboard × Cozy Campus Island**

깔끔한 생산성 대시보드 구조에 따뜻하고 편안한 캠퍼스·자연 분위기를 결합합니다. 평소에는 차분하고, 자세 회복 순간에만 짧고 선명한 아케이드 효과를 사용합니다.

기준 이미지:

- `references/dashboard-ui-concept.png`
- `references/character-growth-final.jpeg`

## 2. 시각 원칙

- 아이보리 배경을 60% 이상 사용
- 핑크·노랑·파랑은 역할별 카드에 사용
- 검정·딥 네이비 텍스트로 가독성 확보
- 초록은 캐릭터·프라이버시·안정 상태에 사용
- 코랄은 CTA·회복 순간에 제한적으로 사용
- 둥근 카드와 넓은 여백
- 식물·잎사귀·캠퍼스 소품을 장식으로 사용
- 의료 대시보드처럼 차갑고 위협적인 인상 금지

## 3. 컬러 토큰

| 토큰 | 값 | 역할 |
|---|---|---|
| `bg-canvas` | `#FBF7EC` | 전체 배경 |
| `surface` | `#FFFFFF` | 기본 카드 |
| `text-primary` | `#171717` | 주요 텍스트 |
| `text-secondary` | `#6F6A62` | 설명 |
| `border` | `#E7E0D4` | 경계 |
| `pink-500` | `#F45B8D` | 세션·회복·CTA |
| `pink-100` | `#FCE1EA` | 핑크 카드 |
| `yellow-500` | `#F2C94C` | 포인트·출석·보상 |
| `yellow-100` | `#FFF0B8` | 노랑 카드 |
| `blue-500` | `#5F8FF7` | 기록·성장·친구 |
| `blue-100` | `#DDE9FF` | 파랑 카드 |
| `green-700` | `#315E43` | 브랜드 보조·안정 |
| `green-100` | `#E4EEDB` | 초록 카드 |
| `coral-500` | `#FF6464` | 회복 공격·강조 |
| `warning-500` | `#D7A62A` | 경계 |
| `neutral-500` | `#85817B` | away·unstable |

## 4. 색상 역할

| 색 | 용도 |
|---|---|
| 핑크 | 집중 시작, 회복 성공, 친구 이벤트 |
| 노랑 | 출석, 포인트, 보상, 캘린더 선택 |
| 파랑 | 기록, 성장, 정보, 친구 방 CTA |
| 초록 | 캐릭터, 프라이버시, good 상태 |
| 코랄 | 짧은 공격, 중요한 CTA |

한 화면에 강한 색을 2개 이상 크게 사용하지 않습니다.

## 5. 60·30·10 비율

- 60% 아이보리·화이트
- 30% 검정·초록·중립 구조
- 10% 핑크·노랑·파랑·코랄 포인트

## 6. 타이포그래피

기본:

```css
font-family: Pretendard, Inter, system-ui, -apple-system, sans-serif;
```

| 스타일 | 크기 | 굵기 |
|---|---:|---:|
| Display | 52~64px | 700 |
| H1 | 40px | 700 |
| H2 | 30~32px | 700 |
| H3 | 22~24px | 650 |
| Body L | 18px | 400~500 |
| Body | 16px | 400 |
| Caption | 13~14px | 400~500 |
| Timer | 56~72px | 700, tabular nums |

## 7. 레이아웃

### 데스크톱

```text
sidebar 232px
main minmax(0, 1fr)
right rail 300px
gap 24px
page padding 24~32px
max width 1600px
```

### 태블릿

- 오른쪽 레일을 중앙 아래로 이동
- 사이드바 축소
- 카드 2열

### 모바일

- 하단 내비게이션
- 기록·상점·초대 중심
- 카메라 세션은 데스크톱 권장 안내

## 8. 간격

8px 기반:

```text
4, 8, 12, 16, 24, 32, 40, 48, 64, 80
```

## 9. 모서리·그림자

- 작은 버튼: 12~14px
- 기본 버튼: 16px
- 카드: 20~24px
- 큰 세션 카드: 28px
- 그림자: 낮고 넓게
- 게임 성공 순간에만 글로우 강화

## 10. 컴포넌트

### 기본

- Button
- IconButton
- Card
- Badge
- Tag
- Input
- Select
- SegmentedControl
- Toggle
- Modal
- Toast
- Tooltip
- Progress
- Tabs
- Calendar
- EmptyState

### 제품 전용

- SidebarNavigation
- UserSummary
- LearningProfileCard
- CalibrationQualityPanel
- PostureStatusBadge
- CharacterViewport
- GrowthTimeline
- SessionLengthPicker
- BossHealthBar
- RecoveryCombo
- MiniPostureWidget
- AttendanceCalendar
- DailySummaryCard
- RoomParticipantCard
- StretchMotionCard
- StoreItemCard
- PrivacyCard

## 11. 주요 카드 스타일

### 메인 세션 카드

- 핑크 소프트 배경
- 캐릭터 왼쪽
- 상태·콤보 중앙
- 세션 길이·CTA 오른쪽

### 성장 카드

- 파랑 소프트 배경
- 6단계 타임라인
- 현재 단계 파랑 외곽선
- 미래 단계 회색

### 출석 카드

- 노랑 소프트 배경
- 선택 날짜 노랑 원

### 친구 방 카드

- 파랑 그라데이션
- 우뚝 기린 이미지
- `친구 방 만들기`

## 12. 자세 상태

| 상태 | 컬러 | 아이콘·문구 |
|---|---|---|
| good | green | 체크, 편안한 기준에 가까워요 |
| warning | yellow | 점, 자세가 조금 달라지고 있어요 |
| bad | pink/coral | 회복 아이콘, 가볍게 돌아와 볼까요? |
| away | neutral | 자리 아이콘, 잠시 자리를 비웠어요 |
| unstable | neutral/yellow | 카메라 아이콘, 측정하기 어려워요 |
| recovery | blue→green | 진행, 회복 중이에요 |
| success | pink+yellow | 별, 자세를 회복했어요 |

색만으로 상태를 전달하지 않습니다.

## 13. 모션

- 기본 UI: 150~250ms
- 카드 전환: 250~350ms
- 회복·공격: 700~1000ms
- 레벨업: 1200ms 이하
- 반복 흔들림 금지
- 세션 중 화면 전체 전환 금지
- `prefers-reduced-motion`에서 opacity 중심

## 14. 차트

사용:

- 완료 세션
- 감지 가능 시간
- 회복 성공
- 출석
- XP·포인트

사용 금지:

- 평균 자세 점수
- 건강 점수
- 통증 위험
- 학교별 자세 순위

## 15. 접근성

- WCAG 수준의 대비 목표
- 키보드 탐색
- 명확한 포커스 링
- 스크린리더 라벨
- 200% 확대
- 소리 없이 사용 가능
- 감소된 모션
- 차트 텍스트 요약
- WebM 자동 재생은 음소거
