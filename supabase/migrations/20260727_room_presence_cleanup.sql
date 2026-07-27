-- ============================================================================
-- 20260727_room_presence_cleanup.sql (v2 — 보안 강화)
-- 친구 방 생존 신호(heartbeat)·유령 참가자 정리·완주 시 방 종료
--
-- 보안: 모든 RPC 는 호출자가 "그 방의 현재 멤버"일 때만 동작합니다.
--       (security definer 이므로 함수 안에서 직접 멤버십을 검증)
-- 안전: 기존 방 데이터 삭제 없음 / 멱등 / RLS·Realtime 무변경 /
--       rollback 은 하단 주석. 클라이언트는 15초 heartbeat, 45초 무응답 = stale.
-- ============================================================================

-- 0) 멤버십 검사 헬퍼 — 다른 RPC 들의 단일 게이트
create or replace function public.is_room_member(p_room_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_room_member(uuid) to authenticated;

-- 1) 생존 신호 컬럼 (기존 행은 now() 로 채워져 즉시 stale 처리되지 않음)
alter table public.room_members
  add column if not exists last_seen_at timestamptz not null default now();

-- 2) 내 생존 신호 갱신 — 내 행이 없으면(비멤버) 오류
create or replace function public.heartbeat_room_member(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.room_members
     set last_seen_at = now(), updated_at = now()
   where room_id = p_room_id and user_id = auth.uid();
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'not a room member';
  end if;
end; $$;

grant execute on function public.heartbeat_room_member(uuid) to authenticated;

-- 3) 45초 이상 무응답 멤버 정리 — 호출자가 그 방의 멤버일 때만.
--    호출자 자신은 삭제하지 않음. rooms 행 잠금으로 동시 cleanup 직렬화.
create or replace function public.cleanup_stale_members(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_removed integer;
  v_left record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  -- 같은 방을 동시에 정리하는 두 호출을 직렬화합니다.
  perform 1 from public.rooms where id = p_room_id for update;

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
    -- (이론상 도달 불가 — 호출자는 위에서 삭제되지 않음. 방어적으로 유지)
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

-- 4) 두 참가자 모두 완주하면 방을 completed 처리
--    조건: 호출자가 멤버 + 방이 running + 멤버가 정확히 2명 + 둘 다 completed.
--    (빈 방·한 명뿐인 방을 completed 처리하지 않습니다)
create or replace function public.complete_room_if_done(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
  v_done integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  perform 1 from public.rooms
   where id = p_room_id and status = 'running'
   for update;
  if not found then return; end if;

  select count(*),
         count(*) filter (where state = 'completed')
    into v_total, v_done
    from public.room_members
   where room_id = p_room_id;

  if v_total = 2 and v_done = 2 then
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
-- drop function if exists public.is_room_member(uuid);
-- alter table public.room_members drop column if exists last_seen_at;

-- 5) 버려진 방 정리 — 두 사용자가 모두 브라우저를 닫아 cleanup 호출자가
--    없는 방을, 다음 사용자가 방을 만들거나 입장할 때 제한적으로 정리합니다.
--    조건(모두 충족): waiting/running · ended_at 없음 · "모든" 멤버가
--    45초 이상 무응답. 활성 방은 어떤 경우에도 닫히지 않습니다.
create or replace function public.cleanup_abandoned_rooms()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_closed integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  with abandoned as (
    select r.id
      from public.rooms r
     where r.status in ('waiting', 'running')
       and r.ended_at is null
       and exists (select 1 from public.room_members m where m.room_id = r.id)
       and not exists (
         select 1 from public.room_members m
          where m.room_id = r.id
            and m.last_seen_at >= now() - interval '45 seconds'
       )
     limit 10
  )
  update public.rooms r
     set status = 'closed', ended_at = now(), updated_at = now()
    from abandoned a
   where r.id = a.id;
  get diagnostics v_closed = row_count;
  return v_closed;
end; $$;

grant execute on function public.cleanup_abandoned_rooms() to authenticated;

-- ROLLBACK 추가분:
-- drop function if exists public.cleanup_abandoned_rooms();
