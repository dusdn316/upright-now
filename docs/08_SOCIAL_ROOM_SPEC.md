# SOCIAL ROOM SPEC — 실제 2인 친구 방

## 1. 목적

사용자 두 명이 서로의 카메라와 자세 점수를 공유하지 않고도 같은 25분 세션과 공동 마감 몬스터를 경험하도록 합니다.

## 2. 사용자 경험

```text
방 만들기
→ 링크·6자리 코드
→ 친구 입장
→ 익명 인증
→ 두 사람 준비
→ 방장 시작
→ 각자 기기에서 자세 분석
→ 성공 이벤트만 공유
→ 공동 보스·기린 싱크
→ 2분 리셋
→ 공동 결과
```

## 3. 범위

### 포함

- 실제 사용자 2명
- 회원가입 UI 없음
- 방 코드·링크
- 닉네임
- 준비·집중·휴식·자리 비움·완료
- 공동 보스 HP
- 회복·스트레칭·완료 이벤트
- 응원 3종 · P1
- 합동 공격
- 재연결

### 제외

- 자유 채팅
- DM
- 친구 목록
- 카메라 영상
- 개인 자세 상태
- 학교 랭킹
- 공개 프로필

## 4. 인증

친구 방에 처음 진입할 때 Supabase anonymous sign-in을 사용합니다.

사용자는 이메일·전화번호·비밀번호를 입력하지 않습니다.

```ts
await supabase.auth.signInAnonymously();
```

닉네임은 애플리케이션의 로컬 설정과 방 멤버 정보에만 사용합니다.

## 5. 방 상태

```ts
type RoomStatus = "waiting" | "running" | "resting" | "completed" | "closed";
type MemberState = "joining" | "ready" | "focusing" | "resting" | "away" | "completed";
```

## 6. Presence

느리게 바뀌는 상태에 사용합니다.

- userId
- nickname
- role
- state
- characterStage
- connectedAt

프레임별 자세 데이터는 Presence에 넣지 않습니다.

## 7. Broadcast

순간 이벤트에 사용합니다.

```ts
type RoomEvent =
  | {
      id: string;
      type: "recovery_earned";
      participantId: string;
      timestamp: number;
    }
  | {
      id: string;
      type: "stretch_completed";
      participantId: string;
      timestamp: number;
    }
  | {
      id: string;
      type: "session_completed";
      participantId: string;
      timestamp: number;
    }
  | {
      id: string;
      type: "reaction_sent";
      participantId: string;
      reaction: "cheer" | "reset" | "done";
      timestamp: number;
    };
```

## 8. 서버에 저장하는 데이터

### rooms

- id
- code
- host_user_id
- subject
- goal
- duration_seconds
- status
- boss_hp
- boss_max_hp
- created_at
- started_at
- ended_at

### room_members

- room_id
- user_id
- nickname
- role
- state
- joined_at
- updated_at

### 저장하지 않음

- 카메라 영상·사진
- 프레임별 랜드마크
- 개인 캘리브레이션
- bad 상태
- 나쁜 자세 시간
- 건강 정보

## 9. 방 규칙

| 상황 | 처리 |
|---|---|
| 방 생성 | 6자리 영문·숫자 코드, 최대 2명 |
| 시작 | 두 사람 ready, 방장만 시작 |
| 늦은 입장 | running 상태에서는 입장 차단 또는 관전 없이 다음 세션 안내 |
| 방장 이탈 | 상대에게 방장 이전 |
| 연결 끊김 | 30초 재연결 대기, 개인 타이머 유지 |
| 재연결 실패 | 혼자 모드 전환 선택 |
| 한 명 away | 공동 타이머 유지, 해당 사용자 이벤트 정지 |
| 한 명 완료 | 완료 상태, 상대 계속 |
| 둘 다 완료 | 최종 합동 공격·공동 결과 |
| 방 종료 | ended_at 기록 후 채널 해제 |

## 10. 공동 보스 일관성

보스 HP는 데이터베이스의 `rooms.boss_hp`를 기준으로 합니다.

- 클라이언트가 임의로 최종 HP를 덮어쓰지 않습니다.
- `apply_room_damage(room_id, damage, event_id)` RPC로 원자적 감소를 권장합니다.
- event_id로 중복 이벤트를 방지합니다.
- UI는 Realtime DB 변경 또는 Broadcast 결과를 반영합니다.

## 11. 기린 싱크

- 서로 다른 사용자
- 10초 이내 회복
- 사용되지 않은 이벤트
- 합동 보너스 60
- 한 쌍당 1회

친구의 bad 상태를 추측할 수 있는 문구를 사용하지 않습니다.

## 12. 응원 3종 · P1

- 조금만 더
- 같이 리셋하자
- 나도 완료했어

세션 중 화면 구석에 짧게 표시하고, 반복 스팸을 제한합니다.

## 13. 보안

- private Realtime channel
- 익명 사용자는 authenticated role
- RLS 활성화
- 방 멤버만 rooms·room_members 접근
- 닉네임 길이·문자 검증
- 방 코드 시도 제한
- 이벤트 스키마 Zod 검증
- 클라이언트의 damage 값 상한 검증
- 서비스 역할 키 프론트 금지

## 14. 실패·복구

| 실패 | 복구 |
|---|---|
| Supabase 미설정 | 친구 방 비활성화, 혼자 모드 유지 |
| 익명 인증 실패 | 재시도·혼자 시작 |
| 방 없음 | 코드 확인·새 방 만들기 |
| 방 가득 참 | 2명 제한 안내 |
| Presence 끊김 | 재구독 |
| Broadcast 지연 | DB HP를 최종 기준으로 동기화 |
| 방장 연결 해제 | 권한 이전 |

## 15. QA

- 서로 다른 브라우저·시크릿 창으로 테스트
- 두 사용자 준비 전 시작 불가
- 한 회복 이벤트 중복 피해 없음
- 기린 싱크 1회
- 연결 끊김 후 개인 세션 유지
- 네트워크 요청에 자세 좌표 없음
- RLS로 비멤버 접근 차단
