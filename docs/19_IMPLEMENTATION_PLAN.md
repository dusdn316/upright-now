# IMPLEMENTATION PLAN

## 원칙

- 한 번에 전체 기능을 구현하지 않습니다.
- 각 단계는 이전 단계의 빌드·테스트 통과 후 진행합니다.
- 화면 목업 → 상태 모델 → 실제 외부 기능 순서로 구현합니다.
- 각 단계의 Preview URL을 확인합니다.

## Phase 1 — 프로젝트 골격과 시각 시스템

### 목표

카메라 없이도 모든 주요 화면과 게임 흐름을 클릭할 수 있습니다.

### 작업

- React·Vite·TypeScript
- Router
- 디자인 토큰
- 사이드바·대시보드
- 닉네임
- 학습 프로필
- 세션 설정
- QA Lab
- mock posture state
- 캐릭터 6단계 목업
- 몬스터·XP·포인트 목업
- 스트레칭·결과·기록·상점 목업

### 완료

- 모든 라우트 이동
- 25분 기본값
- QA 상태로 캐릭터·공격 반응
- Vercel Preview 가능

## Phase 2 — 로컬 저장과 상태 머신

### 작업

- Dexie schema
- 닉네임·프로필·설정
- 세션 타이머
- posture state machine
- recovery opportunity
- cooldown
- XP·포인트·출석
- 상점 구매·장착
- 데이터 초기화

### 완료

- 새로고침 후 기록 유지
- 상태 단위 테스트
- 중복 보상 없음

## Phase 3 — MediaPipe

### 작업

- 카메라 안내
- getUserMedia
- Pose Landmarker
- 5초 캘리브레이션
- feature normalization
- quality state
- actual posture state
- model·camera cleanup

### 완료

- 카메라 영상 전송 없음
- good·warning·bad·away·unstable
- 회복 공격 실제 연동
- 카메라 오류 복구

## Phase 4 — 스트레칭·에셋 완성

### 작업

- 6종 가중 랜덤
- WebM·WebP
- 모드별 추천
- 감소된 모션
- 캐릭터 실제 에셋 교체
- 보스 상태 에셋
- 사운드 설정

### 완료

- 도서관·내 공간·팀플 차이
- 반복 추천 방지
- 에셋 누락 폴백

## Phase 5 — Supabase 2인 방

### 작업

- Supabase 프로젝트
- anonymous sign-in
- schema·RLS
- 방 생성·입장
- Presence
- Broadcast
- atomic damage
- 기린 싱크
- 재연결
- 혼자 모드 전환

### 완료

- 두 브라우저 동기화
- 비멤버 차단
- 자세 데이터 전송 없음

## Phase 6 — 완성도·배포

### 작업

- PIP feature detection
- E2E
- 접근성
- 성능
- 직접 URL rewrite
- Preview·Production 환경 변수
- QA Lab production 비활성

### 완료

- lint·typecheck·test·build 통과
- Production URL
- 카메라·2인 방·상점 검증

## 첫 Claude Code 작업 단위

1. 문서 읽기
2. 구현 계획 보고
3. Vite scaffold
4. 디자인 토큰
5. App shell·Router
6. 대시보드 정적 화면
7. QA Lab 상태 모델

첫 작업에서 MediaPipe·Supabase를 동시에 연결하지 않습니다.
