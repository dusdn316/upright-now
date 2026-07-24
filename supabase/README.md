# Supabase 2인 방 설정

이 폴더는 UpRight Now의 실제 2인 친구 방을 위한 프로토타입 스키마입니다.

## 적용 순서

1. Supabase 프로젝트를 만듭니다.
2. Authentication에서 Anonymous Sign-Ins를 활성화합니다.
3. SQL Editor에서 `schema.sql`을 실행합니다.
4. Realtime에서 `rooms`, `room_members` 테이블 변경을 사용할 경우 publication 설정을 확인합니다.
5. Project URL과 Publishable key를 Vercel 환경 변수에 입력합니다.
6. 서로 다른 두 브라우저에서 방 생성·입장을 확인합니다.

## 환경 변수

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## 주의

- 이 스키마는 2인 프로토타입 기준입니다.
- 운영 전 RLS·rate limit·CAPTCHA·익명 사용자 정리 정책을 다시 검토합니다.
- 카메라·랜드마크·자세 좌표를 테이블이나 Broadcast payload에 넣지 않습니다.
- 서비스 역할 키를 프론트엔드에 넣지 않습니다.
