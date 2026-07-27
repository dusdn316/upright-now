-- ============================================================================
-- 20260726_room_lifecycle_security.sql
-- 친구 방 생명주기 서버 검증 + HP·방어막 직접 수정 차단
--
--   1) start_room_session(p_room_id) — 방장·waiting·2명·둘 다 ready 를
--      서버에서 검증한 뒤에만 세션을 시작합니다. (UI disabled 는 보조 수단)
--   2) leave_room(p_room_id) — 내 멤버 행 정리. 마지막 참가자가 나가면
--      방을 closed + ended_at 처리하고, 방장이 나가면 남은 참가자에게
--      방장을 이전합니다.
--   3) rooms 트리거 — boss_hp·boss_max_hp·shield 를 클라이언트가 직접
--      UPDATE 하는 것을 차단합니다. 피해·방어막은 기존 apply_room_damage /
--      apply_room_shield RPC(security definer)로만 변경됩니다.
--
-- 안전 보장: 데이터 삭제·테이블 재생성 없음 · RLS 정책 변경 없음 ·
--            Realtime 설정 변경 없음 · 여러 번 실행해도 안전(멱등).
-- ============================================================================

-- 1) 세션 시작 서버 검증
create or replace function public.start_room_session(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_members integer;
  v_ready integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'room not found';
  end if;

  if v_room.host_user_id <> auth.uid() then
    raise exception 'only the host can start';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'room is not waiting';
  end if;

  select count(*), count(*) filter (where state = 'ready')
    into v_members, v_ready
  from public.room_members
  where room_id = p_room_id;

  if v_members <> 2 then
    raise exception 'room needs two members';
  end if;

  if v_ready <> 2 then
    raise exception 'both members must be ready';
  end if;

  update public.rooms
  set status = 'running', started_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.start_room_session(uuid) to authenticated;

-- 2) 방 나가기 정리
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_was_host boolean;
  v_remaining uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return; -- 이미 정리된 방 — 조용히 종료
  end if;

  v_was_host := v_room.host_user_id = auth.uid();

  delete from public.room_members
  where room_id = p_room_id and user_id = auth.uid();

  select user_id into v_remaining
  from public.room_members
  where room_id = p_room_id
  limit 1;

  if v_remaining is null then
    -- 마지막 참가자가 나감 → 방 종료
    update public.rooms
    set status = 'closed', ended_at = now()
    where id = p_room_id and status <> 'closed';
  elsif v_was_host then
    -- 방장 이탈 → 남은 참가자에게 방장 이전
    update public.rooms set host_user_id = v_remaining where id = p_room_id;
    update public.room_members
    set role = 'host'
    where room_id = p_room_id and user_id = v_remaining;
  end if;
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;

-- 3) boss_hp·boss_max_hp·shield 직접 UPDATE 차단
--    security definer RPC(함수 소유자 권한)는 통과하고,
--    클라이언트(authenticated 역할)의 직접 UPDATE 만 거부합니다.
create or replace function public.rooms_block_direct_combat_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.boss_hp is distinct from old.boss_hp
          or new.boss_max_hp is distinct from old.boss_max_hp
          or new.shield is distinct from old.shield) then
    raise exception 'combat values change only through RPC';
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_block_direct_combat on public.rooms;
create trigger rooms_block_direct_combat
before update on public.rooms
for each row execute function public.rooms_block_direct_combat_update();

-- ============================================================================
-- ROLLBACK (되돌릴 때 아래 주석을 해제해 실행)
-- ============================================================================
-- drop trigger if exists rooms_block_direct_combat on public.rooms;
-- drop function if exists public.rooms_block_direct_combat_update();
-- drop function if exists public.leave_room(uuid);
-- drop function if exists public.start_room_session(uuid);
