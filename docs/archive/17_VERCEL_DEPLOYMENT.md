# VERCEL DEPLOYMENT

## 1. 전제

Vercel에는 문서만 올리는 것이 아니라 `package.json`, `src/`, `public/`, 빌드 설정이 포함된 실제 Vite 프로젝트를 배포합니다.

## 2. 권장 배포 방식

```text
GitHub repository
→ Vercel Import
→ Preview deployment per branch/PR
→ main branch production deployment
```

## 3. Vite 설정

| 항목 | 값 |
|---|---|
| Framework Preset | Vite |
| Root Directory | `./` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production Branch | `main` |

대부분 자동 감지되지만 Project Settings에서 확인합니다.

## 4. SPA rewrite

React Router 직접 주소 접근을 위해 루트에 `vercel.json`을 둡니다.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

`templates/vercel.json`을 복사할 수 있습니다.

## 5. 환경 변수

Vercel Project Settings → Environment Variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_ENABLE_REALTIME=true
VITE_ENABLE_PIP=true
VITE_ENABLE_QA_LAB=false
```

Preview 환경에서는 QA Lab을 켤 수 있습니다.

```text
VITE_ENABLE_QA_LAB=true
```

secret·service role key는 등록하지 않습니다.

## 6. Supabase 설정

1. 프로젝트 생성
2. Anonymous Sign-Ins 활성화
3. `supabase/schema.sql` 실행
4. RLS 정책 확인
5. Project URL·Publishable key 복사
6. Vercel 환경 변수 입력
7. Preview에서 2개 브라우저 테스트

익명 로그인 남용 방지를 위해 운영 전 CAPTCHA·rate limit을 검토합니다.

## 7. 배포 전 로컬 확인

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

## 8. GitHub 연결

- 저장소를 Vercel에 Import
- Preview와 Production 환경 변수 구분
- Pull Request마다 Preview URL 확인
- main merge 후 Production 확인

## 9. 배포 확인 경로

- `/`
- `/onboarding/name`
- `/profiles`
- `/camera`
- `/calibration`
- `/session/setup`
- `/session/demo`
- `/stretch/demo`
- `/result/demo`
- `/history`
- `/growth`
- `/shop`
- `/room/new`
- `/settings`

직접 URL 새로고침이 404가 아닌지 확인합니다.

## 10. 카메라

- HTTPS에서 확인
- Chrome·Edge 우선
- 권한 거부·허용 재시도
- 다른 앱 카메라 사용 중 처리
- 배포 도메인에서 실제 `getUserMedia` 확인

## 11. 배포 환경

### Local

개발과 빠른 테스트.

### Preview

- QA Lab 가능
- 기능·디자인 리뷰
- Supabase 테스트 프로젝트 또는 별도 방 prefix

### Production

- QA Lab 기본 비활성
- 실제 프라이버시 문구
- 안정된 환경 변수
- 공개 링크

## 12. 롤백

- main 배포 전 Preview 확인
- 치명적 오류 시 이전 안정 deployment로 롤백
- 데이터 스키마 변경은 호환성 유지

## 13. 배포 실패 체크

| 증상 | 확인 |
|---|---|
| Build failed | Node·패키지·TypeScript |
| 환경 변수 undefined | Vercel scope·재배포 |
| 직접 URL 404 | `vercel.json` rewrite |
| 카메라 권한 안 뜸 | HTTPS·브라우저 권한 |
| 친구 방 안 됨 | Supabase URL·key·anonymous auth·RLS |
| 이미지 깨짐 | public 경로·대소문자 |
| 새 배포에 설정 미반영 | 환경 변수 변경 후 redeploy |

## 14. 완료 기준

- Production URL 접속
- 핵심 경로 직접 새로고침
- 카메라 캘리브레이션
- 3분 데모
- 두 브라우저 친구 방
- 데이터 삭제
- 모바일에서 데스크톱 권장 안내
