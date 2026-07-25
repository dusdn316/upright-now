# UpRight Now

노트북 공부 중 흐트러진 자세를 조용히 알아차리고, 회복할 때마다
거북이 캐릭터가 기린으로 성장하는 자세 회복 스터디 웹앱.

**Production**: https://upright-now.vercel.app

## 구현된 핵심 기능

- **온디바이스 자세 감지** — MediaPipe Pose Landmarker(브라우저 내 추론),
  5초 개인 기준 캘리브레이션, 개인 기준 대비 상대 변화만 판정
- **회복 게임** — 이탈 5초 지속 → 회복 기회 → 기준 복귀 5초 → 특수 공격
  (마감괴수 -40 · XP +30 · 잎사귀 +10, 세션당 XP 보상 상한 5회)
- **집중 세션** — 25분 기본(15/50분·3분 데모), 80% 이상 진행 시 완주 인정
- **성장·상점** — XP 파생 6단계(뽀각 거북 → 우뚝 기린), 잎사귀로 과잠·백팩
  구매/장착, 첫 완주 후 상점 해제
- **기록·설정** — 세션 요약·주간 출석, 민감도·소리·닉네임·전체 데이터 초기화
- **스트레칭 6종** — 모드별 가중 랜덤, 건너뛰기 불이익 없음
- **PIP 미니 위젯** — Document Picture-in-Picture(Chrome/Edge 116+),
  설정에서 자동 열기 토글. 미지원·차단 시 화면 안 미니 위젯으로 자동 대체,
  PIP 실패·닫힘이 세션을 중단시키지 않음
- **2인 친구 방** — Supabase 익명 인증 + Realtime, 6자리 코드 입장,
  공동 마감괴수(HP 2000), 기린 싱크 합동 공격, 스트레칭 방어막, 반응 3종

## 개인정보 처리 원칙

- 모든 영상 분석은 브라우저 안에서만 수행합니다.
- 카메라 영상·사진·프레임·랜드마크 원본은 저장·전송하지 않습니다.
- 로컬에는 개인 기준 **요약값**과 세션 집계만 저장합니다.
- 친구 방에는 닉네임·진행 상태·성공 이벤트만 전송합니다
  (bad 상태·자세 좌표·개인 기준은 전송 금지, 코드 레벨에서 차단).
- 의료 진단·치료를 제공하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

## 테스트

```bash
npm run lint
npm run typecheck
npm run test       # Vitest 단위 테스트
npm run test:e2e   # Playwright (자체 서버, 포트 5273)
npm run build
```

친구 방 라이브 검증(두 브라우저 컨텍스트, Supabase 필요):

```bash
npx playwright test e2e/room-live.spec.ts
```

## 환경 변수 (이름만 — 값은 Vercel·.env.local 에)

| 이름 | 용도 |
|---|---|
| `VITE_ENABLE_CAMERA` | 실제 웹캠 자세 감지 on/off |
| `VITE_ENABLE_FRIEND_ROOM` | 2인 친구 방 on/off |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL (친구 방) |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key (친구 방) |
| `VITE_ENABLE_QA_LAB` | 개발용 QA Lab (운영 기본 off) |

친구 방 백엔드는 `supabase/schema.sql` 로 구성합니다
(RLS + RPC 원자적 보스 HP, Anonymous Sign-Ins 필요).

## 친구 방 구조

```
익명 로그인 → create_room/join_room RPC (RLS)
→ Realtime Presence(준비·집중·자리비움) + Broadcast(회복·완료·응원)
→ 보스 HP 는 DB 가 최종 기준: apply_room_damage RPC (event_id 중복 차단)
→ 기린 싱크: 10초 내 양쪽 회복 → XOR 파생 id 로 1회만 -60
연결 끊김 → 30초 재시도 → 실패 시 혼자 모드(개인 세션 유지)
```

## 문서

- 인수인계: [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)
- 기획·스펙 원문: [docs/](docs/) (00~21)
