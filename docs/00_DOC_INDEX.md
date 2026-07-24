# 문서 인덱스

| 항목 | 내용 |
|---|---|
| 프로젝트 | UpRight Now |
| 문서 버전 | V1.0 |
| 문서 상태 | 웹 프로토타입 구현 기준안 |
| 기준일 | 2026-07-24 |
| 최신 기준 | 이 폴더의 문서가 이전 기린이 되자·Zarafa 문서보다 우선 |

## 문서 목록

| 번호 | 문서 | 역할 |
|---:|---|---|
| 01 | PRODUCT_BRIEF | 문제·사용자·가치·차별화 |
| 02 | PRD | 기능 요구사항과 우선순위 |
| 03 | USER_FLOW | 행동·상태·예외 복구 |
| 04 | IA | 라우트·정보 구조·내비게이션 |
| 05 | SCREEN_SPEC | 화면별 요소·상태·인터랙션 |
| 06 | POSTURE_ENGINE_SPEC | 캘리브레이션·자세 상태·회복 판정 |
| 07 | GAME_SYSTEM_SPEC | 성장·보스·XP·포인트·악용 방지 |
| 08 | SOCIAL_ROOM_SPEC | 실제 2인 방과 Supabase 이벤트 |
| 09 | STRETCH_SYSTEM_SPEC | 6종 모션과 모드별 가중 랜덤 |
| 10 | CHARACTER_ASSET_SPEC | 6단계 캐릭터와 WebP·WebM 규격 |
| 11 | STORE_CUSTOMIZATION_SPEC | 과잠·백팩 상점과 장착 규칙 |
| 12 | DESIGN_SYSTEM | 컬러·타이포·레이아웃·컴포넌트 |
| 13 | UX_COPY | 실제 화면 문구 |
| 14 | DATA_PRIVACY_SECURITY | 로컬·서버 데이터 경계와 보안 |
| 15 | TECHNICAL_ARCHITECTURE | 모듈·스택·데이터 흐름 |
| 16 | ACCEPTANCE_TESTS | 완료 기준·테스트·출시 차단 |
| 17 | VERCEL_DEPLOYMENT | GitHub·환경 변수·배포 |
| 18 | ASSET_MANIFEST | 필요한 이미지·모션·사운드 목록 |
| 19 | IMPLEMENTATION_PLAN | Claude Code 구현 순서 |
| 20 | DECISION_LOG | 확정 결정과 근거 |
| 21 | RESEARCH_BASIS | 문제 정의 근거 요약 |

## 대상별 읽기 순서

### 기획·발표

`01 → 02 → 03 → 20 → 21`

### UI·UX

`01 → 04 → 05 → 10 → 12 → 13 → 18`

### 프론트엔드

`AGENTS → 02 → 03 → 05 → 15 → 16 → 17 → 19`

### 자세 엔진

`AGENTS → 06 → 14 → 16`

### 2인 방

`AGENTS → 08 → 14 → 15 → supabase/schema.sql`
