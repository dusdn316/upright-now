# docs/archive — 초기 기획 기록

**당시 기획 기록입니다. 개발 과정에서 수치가 바뀌었으므로 현재 값이 아닙니다.**

여기 있는 문서는 2026년 7월 개발 시작 시점의 기획·스펙 원문입니다.
"왜 이렇게 만들었는지"를 이해하는 데는 좋지만, 숫자(보상·가격·체력·시간)는
그동안 여러 번 조정됐습니다.

**현재 기준 값은 [docs/TEAM_START.md](../TEAM_START.md) 를 보세요.**
그보다 더 정확한 것은 언제나 코드(`src/constants/`)입니다.

## 기획·스펙 문서

| 파일 | 내용 |
|---|---|
| `00_DOC_INDEX.md` | 전체 문서 목록과 읽는 순서 |
| `01_PRODUCT_BRIEF.md` | 제품 한 줄 정의·타깃 사용자·핵심 가치 |
| `02_PRD.md` | 기능 요구사항 목록(FR-001~017)과 우선순위 |
| `03_USER_FLOW.md` | 첫 방문부터 결과 화면까지의 사용자 흐름도 |
| `04_IA.md` | 화면 구조와 라우팅 지도 |
| `05_SCREEN_SPEC.md` | 화면별 구성 요소와 상태별 표현 |
| `06_POSTURE_ENGINE_SPEC.md` | 자세 판정 알고리즘 설계(랜드마크·투표·상태 머신) |
| `07_GAME_SYSTEM_SPEC.md` | 회복 게임·보스·성장·보상 설계 |
| `08_SOCIAL_ROOM_SPEC.md` | 2인 친구 방 구조와 동기화 규칙 |
| `09_STRETCH_SYSTEM_SPEC.md` | 스트레칭 6종 추천 규칙 |
| `10_CHARACTER_ASSET_SPEC.md` | 캐릭터 6단계 디자인 요구사항 |
| `11_STORE_CUSTOMIZATION_SPEC.md` | 상점 아이템·장착 규칙 |
| `12_DESIGN_SYSTEM.md` | 색·타이포·간격·컴포넌트 설계 의도 |
| `13_UX_COPY.md` | 화면 문구 톤과 문장 원칙 |
| `15_TECHNICAL_ARCHITECTURE.md` | 기술 스택·폴더 구조·기능 플래그 설계 |
| `16_ACCEPTANCE_TESTS.md` | 인수 테스트 시나리오 |
| `17_VERCEL_DEPLOYMENT.md` | Vercel 배포 설정 절차 |
| `18_ASSET_MANIFEST.md` | 필요한 이미지·사운드 목록 |
| `19_IMPLEMENTATION_PLAN.md` | 구현 순서와 단계별 계획 |

## 캠퍼스 문서 — 연우 캠퍼스 작업 참고용

| 파일 | 내용 |
|---|---|
| `CAMPUS_DATA_MODEL.md` | 캠퍼스 테이블 구조·기여 이벤트 데이터 모델 |
| `CAMPUS_THEME_SPEC.md` | 학교 선택 → 테마 색이 적용되는 범위 |
| `CAMPUS_TERRITORY_SPEC.md` | 영토전 규칙(기여·점령·경합·시즌) 설계 |

캠퍼스 3개 문서는 설계 의도를 담고 있어 지우지 않았습니다.
다만 실제 구현은 문서보다 더 나아갔습니다 — 특히:

- 영토 수: 문서 36 → **현재 96 (12×8)**
- 저장소: 문서에는 없던 서버 권위 구조(점수를 서버가 결정, 기여 원장 비공개)
- 학교 디렉터리: 커스텀 학교를 모든 사용자가 볼 수 있는 테이블이 추가됨

캠퍼스 관련 최신 구조는 `supabase/migrations/20260727_campus_final_grid_realtime.sql`
과 `src/features/campus/` 코드가 기준입니다.

## 여기 없는 문서

`docs/` 최상위에 남아 있는 것들은 지금도 유효합니다.

- `docs/TEAM_START.md` — 팀 시작 안내서 (먼저 읽으세요)
- `docs/AI_HANDOFF.md` — 기술 인수인계 (코드 기준 수치)
- `docs/14_DATA_PRIVACY_SECURITY.md` — 개인정보 처리 원칙 (지금도 지켜야 하는 규칙)
- `docs/20_DECISION_LOG.md` — 주요 의사결정 기록
- `docs/21_RESEARCH_BASIS.md` — 자세·집중 관련 참고 자료
