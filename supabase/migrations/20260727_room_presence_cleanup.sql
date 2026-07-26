-- ============================================================================
-- 20260727_room_presence_cleanup.sql
-- 친구 방 생존 신호(heartbeat)·유령 참가자 정리·완주 시 방 종료
--
-- 안전 보장: 기존 방·멤버 데이터 삭제 없음 / 멱등(여러 번 실행 안전) /
-- RLS·Realtime 설정 무변경 / rollback 은 하단 주석.
-- 클라이언트는 15초마다 heartbeat, 45초 이상 무응답이면 stale 로 봅니다.
-- ============================================================================

-- 1) 생존 신호 컬럼 (기존 행은 now() 로 채워져 즉시 stale 처리되지 않음)
alter table public.room_members
  add column if not exists last_seen_at timestamptz not null default now();

-- 2) 내 생존 신호 갱신 (15초 주기 호출)
create or replace function public.heartbeat_room_member(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.room_members
     set last_seen_at = now(), updated_at = now()
   where room_id = p_room_id and user_id = auth.uid();
end; $$;

grant execute on function public.heartbeat_room_member(uuid) to authenticated;

-- 3) 45초 이상 무응답 멤버 정리
--    - stale 멤버 행 삭제
--    - 방장이 stale 이면 남은 참가자에게 방장 이전
--    - 마지막 멤버까지 stale 이면 방 closed + ended_at
create or replace function public.cleanup_stale_members(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_removed integer;
  v_left record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  delete from public.room_members
   where room_id = p_room_id
     and last_seen_at < now() - interval '45 seconds'
     and user_id <> auth.uid();
  get diagnostics v_removed = row_count;
  if v_removed = 0 then return; end if;

  select * into v_left
    from public.room_members
   where room_id = p_room_id
   order by (role = 'host') desc, joined_at asc
   limit 1;

  if v_left is null then
    update public.rooms
       set status = 'closed', ended_at = coalesce(ended_at, now()), updated_at = now()
     where id = p_room_id and status <> 'closed';
    return;
  end if;

  -- 방장이 사라졌으면 남은 참가자에게 이전
  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and role = 'host'
  ) then
    update public.room_members
       set role = 'host', updated_at = now()
     where room_id = p_room_id and user_id = v_left.user_id;
    update public.rooms
       set host_user_id = v_left.user_id, updated_at = now()
     where id = p_room_id;
  end if;
end; $$;

grant execute on function public.cleanup_stale_members(uuid) to authenticated;

-- 4) 두 참가자 모두 완주하면 방을 completed 처리 (세션 완료 → 방 종료 연결)
create or replace function public.complete_room_if_done(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
  v_done integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select count(*),
         count(*) filter (where state = 'completed')
    into v_total, v_done
    from public.room_members
   where room_id = p_room_id;
  if v_total > 0 and v_done = v_total then
    update public.rooms
       set status = 'completed', ended_at = coalesce(ended_at, now()), updated_at = now()
     where id = p_room_id and status = 'running';
  end if;
end; $$;

grant execute on function public.complete_room_if_done(uuid) to authenticated;

-- ============================================================================
-- ROLLBACK (필요 시 주석 해제해 실행 — 데이터 삭제 없음)
-- ============================================================================
-- drop function if exists public.complete_room_if_done(uuid);
-- drop function if exists public.cleanup_stale_members(uuid);
-- drop function if exists public.heartbeat_room_member(uuid);
-- alter table public.room_members drop column if exists last_seen_at;
