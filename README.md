# UpRight Now — Vercel 웹 프로토타입 구현 문서

| 항목 | 내용 |
|---|---|
| 프로젝트 | UpRight Now |
| 슬로건 | 자세를 펴고, 오늘의 목표를 끝내는 시간 |
| 문서 버전 | V1.0 |
| 문서 상태 | 웹 프로토타입 구현 기준안 |
| 작성 기준일 | 2026-07-24 |
| 플랫폼 | 데스크톱 우선 웹앱 |
| 배포 | Vercel |
| 제품 중심 | 자세 관리 70% · 스터디 게임 30% |

## 한 줄 정의

시험·과제·코딩으로 노트북 앞에 오래 앉아 있는 대학생이, 개인 자세 기준에서 벗어난 변화를 조용히 알아차리고 회복할 때마다 캐릭터와 친구들의 게임이 진행되는 자세 회복 스터디 웹앱입니다.

## 핵심 와우 포인트

> **내 자세가 게임 컨트롤러가 된다.**

```text
자세 변화 감지
→ 캐릭터가 조용히 반응
→ 사용자가 자세를 회복
→ 회복 에너지 생성
→ 마감 몬스터 특수 공격
→ 성장·포인트·친구 방 진행
```

## 이 패키지의 목적

이 폴더는 단순한 기획 요약이 아니라 다음 작업을 바로 시작할 수 있도록 만든 구현 인수인계 패키지입니다.

- Claude Code·Codex가 읽을 제품 기준
- React·Vite·TypeScript 웹앱 화면 명세
- MediaPipe 자세 상태 규칙
- 2인 Supabase 실시간 방 명세
- 6단계 캐릭터·상점 에셋 규격
- 핑크·노랑·파랑 파스텔 대시보드 디자인 시스템
- Vercel 배포 설정
- 기능 완료 기준과 QA 시나리오

## 기준 이미지

- 캐릭터 성장 기준: [`references/character-growth-final.jpeg`](./references/character-growth-final.jpeg)
- 웹 대시보드 기준: [`references/dashboard-ui-concept.png`](./references/dashboard-ui-concept.png)

두 이미지는 **시각적 기준**입니다. 캐릭터 원본 시트 자체를 화면에서 잘라 쓰기보다, 동일한 스타일로 단계별 WebP·WebM 에셋을 별도로 제작하는 것을 원칙으로 합니다.

## 문서 읽는 순서

### 제품·디자인 확인

1. [`docs/01_PRODUCT_BRIEF.md`](./docs/01_PRODUCT_BRIEF.md)
2. [`docs/02_PRD.md`](./docs/02_PRD.md)
3. [`docs/03_USER_FLOW.md`](./docs/03_USER_FLOW.md)
4. [`docs/05_SCREEN_SPEC.md`](./docs/05_SCREEN_SPEC.md)
5. [`docs/12_DESIGN_SYSTEM.md`](./docs/12_DESIGN_SYSTEM.md)
6. [`docs/10_CHARACTER_ASSET_SPEC.md`](./docs/10_CHARACTER_ASSET_SPEC.md)

### 개발 시작

1. [`AGENTS.md`](./AGENTS.md)
2. [`docs/06_POSTURE_ENGINE_SPEC.md`](./docs/06_POSTURE_ENGINE_SPEC.md)
3. [`docs/07_GAME_SYSTEM_SPEC.md`](./docs/07_GAME_SYSTEM_SPEC.md)
4. [`docs/08_SOCIAL_ROOM_SPEC.md`](./docs/08_SOCIAL_ROOM_SPEC.md)
5. [`docs/15_TECHNICAL_ARCHITECTURE.md`](./docs/15_TECHNICAL_ARCHITECTURE.md)
6. [`docs/16_ACCEPTANCE_TESTS.md`](./docs/16_ACCEPTANCE_TESTS.md)
7. [`CLAUDE_CODE_MASTER_PROMPT.md`](./CLAUDE_CODE_MASTER_PROMPT.md)

## 핵심 프로토타입 범위

### 반드시 실제 작동

- 로그인 없는 닉네임 저장
- 도서관·내 공간·팀플 학습 프로필
- 카메라 권한 안내
- 5초 개인 자세 기준 등록
- MediaPipe 기반 자세 상태 5단계
- 25분 집중·2분 리셋
- 6단계 캐릭터 성장
- 자세 회복 특수 공격
- 개인 마감 몬스터
- 모드별 스트레칭 랜덤
- 결과·출석·경험치·잎사귀 포인트
- 대학 컬러 과잠·캠퍼스 백팩 상점
- 실제 2인 친구 방
- 공동 보스·기린 싱크 합동 공격
- 로컬 기록 삭제
- 개발용 QA Lab

### 선택적 기능

- Document Picture-in-Picture
- 소리·TTS
- 선택형 흐트러짐 자세 등록
- 사용자 정의 학습 모드

### 제외

- 의료 진단과 치료 효과
- 실제 집중도 AI 판정
- 카메라 영상 업로드
- 실시간 3D 모델·리깅
- 자유 채팅
- 공개 자세 점수·랭킹
- 공식 학교 로고·마스코트 무단 사용
- 결제·현금 상금

## 권장 기술

| 영역 | 권장안 |
|---|---|
| 앱 | React + Vite + TypeScript |
| 라우팅 | React Router |
| 전역 상태 | Zustand 또는 명시적 Reducer |
| 스타일 | Tailwind CSS 또는 CSS Modules |
| 자세 감지 | `@mediapipe/tasks-vision` Pose Landmarker |
| 로컬 저장 | IndexedDB + Dexie |
| 친구 방 | Supabase Auth Anonymous + Realtime Presence/Broadcast |
| 캐릭터 | WebP 정지 이미지 + WebM 짧은 모션 |
| 애니메이션 | Motion 계열 라이브러리 |
| 테스트 | Vitest + Testing Library + Playwright |
| 배포 | Vercel |

## 프로젝트 생성 후 예상 명령

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## 가장 먼저 할 작업

1. 이 문서 패키지를 새 GitHub 저장소의 최상단에 넣습니다.
2. `CLAUDE_CODE_MASTER_PROMPT.md`를 Claude Code에 전달합니다.
3. 1단계에서는 실제 카메라 대신 QA 상태로 전체 흐름을 연결합니다.
4. 2단계에서 MediaPipe를 연결합니다.
5. 3단계에서 Supabase 2인 방을 연결합니다.
6. 로컬 빌드가 성공한 뒤 GitHub를 Vercel에 연결합니다.
