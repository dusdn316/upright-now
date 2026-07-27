-- ============================================================================
-- 20260726_expand_room_duration.sql
-- 친구 방 사용자 지정 세션 길이 허용: duration_seconds 180~7200초 (3분~120분)
--
-- 안전 보장:
--   * 기존 방(180·900·1500·3000초)은 모두 새 범위 안 → 데이터 그대로 유효
--   * 데이터 삭제·테이블 재생성 없음 (제약 조건과 검증 한 줄만 변경)
--   * RLS 정책·Realtime 설정·권한(grants)은 건드리지 않음
--     (create or replace 는 함수의 기존 권한을 그대로 유지합니다)
--   * 여러 번 실행해도 오류 없음 (멱등)
--
-- 참고: 5분 단위 스냅은 프론트(clampCustomFocusMin)가 담당하고,
--       DB 는 초 단위 범위(180~7200)만 안전하게 검증합니다.
-- ============================================================================

-- 1) duration_seconds 에 걸린 기존 CHECK 제약을 이름과 무관하게 제거
--    (라이브 DB 의 실제 제약 이름을 몰라도 안전하게 동작)
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'rooms'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%duration_seconds%'
  loop
    execute format('alter table public.rooms drop constraint %I', c.conname);
  end loop;
end
$$;

-- 2) 새 범위 제약 추가 — 기존 행(180/900/1500/3000)은 모두 통과
alter table public.rooms
  add constraint rooms_duration_range_check
  check (duration_seconds between 180 and 7200);

-- 3) create_room 의 duration 검증을 IN-목록 → 범위로 확장
--    기존 함수와 시그니처·본문 동일, 검증 조건 한 줄만 변경.
--    security definer / search_path / 권한은 그대로 유지됩니다.
create or replace function public.create_room(
  p_code text,
  p_nickname text,
  p_subject text default null,
  p_goal text default null,
  p_duration_seconds integer default 1500
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'invalid room code';
  end if;

  if char_length(trim(p_nickname)) < 1 or char_length(trim(p_nickname)) > 12 then
    raise exception 'invalid nickname';
  end if;

  if p_duration_seconds < 180 or p_duration_seconds > 7200 then
    raise exception 'invalid duration';
  end if;

  insert into public.rooms (
    code, host_user_id, subject, goal, duration_seconds
  ) values (
    p_code, auth.uid(), nullif(trim(p_subject), ''), nullif(trim(p_goal), ''), p_duration_seconds
  ) returning id into v_room_id;

  insert into public.room_members (
    room_id, user_id, nickname, role, state
  ) values (
    v_room_id, auth.uid(), trim(p_nickname), 'host', 'ready'
  );

  return v_room_id;
end;
$$;

-- ============================================================================
-- ROLLBACK (되돌릴 때 아래 블록의 주석을 해제해 실행)
-- 주의: 사용자 지정 길이로 이미 만들어진 방이 있으면 1번 제약 추가가 실패합니다.
--       그런 행이 없을 때만 되돌리세요.
--       확인: select count(*) from public.rooms
--             where duration_seconds not in (180, 900, 1500, 3000);
-- ============================================================================
-- alter table public.rooms drop constraint if exists rooms_duration_range_check;
-- alter table public.rooms
--   add constraint rooms_duration_seconds_check
--   check (duration_seconds in (180, 900, 1500, 3000));
--
-- create or replace function public.create_room(
--   p_code text,
--   p_nickname text,
--   p_subject text default null,
--   p_goal text default null,
--   p_duration_seconds integer default 1500
-- )
-- returns uuid
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_room_id uuid;
-- begin
--   if auth.uid() is null then
--     raise exception 'authentication required';
--   end if;
--   if p_code !~ '^[A-Z0-9]{6}$' then
--     raise exception 'invalid room code';
--   end if;
--   if char_length(trim(p_nickname)) < 1 or char_length(trim(p_nickname)) > 12 then
--     raise exception 'invalid nickname';
--   end if;
--   if p_duration_seconds not in (180, 900, 1500, 3000) then
--     raise exception 'invalid duration';
--   end if;
--   insert into public.rooms (
--     code, host_user_id, subject, goal, duration_seconds
--   ) values (
--     p_code, auth.uid(), nullif(trim(p_subject), ''), nullif(trim(p_goal), ''), p_duration_seconds
--   ) returning id into v_room_id;
--   insert into public.room_members (
--     room_id, user_id, nickname, role, state
--   ) values (
--     v_room_id, auth.uid(), trim(p_nickname), 'host', 'ready'
--   );
--   return v_room_id;
-- end;
-- $$;
