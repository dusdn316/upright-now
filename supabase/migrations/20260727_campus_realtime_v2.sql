-- ============================================================================
-- 20260727_campus_realtime_v2.sql
-- 캠퍼스 영토전 실시간 v2 — 커스텀 학교(stable key)·불규칙 territory 모델.
--
-- Production 에 직접 실행하지 마세요. Preview 검증 후 별도 승인으로 적용합니다.
-- 멱등(여러 번 실행 안전) / 기존 friend-room 테이블·RLS 무변경 /
-- 카메라·자세 데이터는 어떤 컬럼에도 존재하지 않습니다.
--
-- 점수 정책:
--  * 영토 공격·점령은 raw contribution 만 사용 (apply_campus_contribution → capture)
--  * 순위 표시는 보정 점수 totalContribution / sqrt(max(activeContributors,1))
--    를 뷰(campus_school_rankings)에서만 계산 — 점령 로직에 개입하지 않음
-- ============================================================================

-- 1) 학교 — 프리셋 + 사용자 정의(비공식, stable key = 'custom-<hash>')
create table if not exists public.campus_schools (
  id text primary key,                    -- 'snu' | 'korea' | ... | 'custom-9f3a1c2b'
  display_name text not null check (char_length(display_name) between 2 and 30),
  short_name text not null check (char_length(short_name) between 2 and 8),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.campus_schools enable row level security;

drop policy if exists campus_schools_select on public.campus_schools;
create policy campus_schools_select on public.campus_schools
  for select to authenticated using (true);

-- 커스텀 학교 등록은 RPC(upsert_custom_school)로만 — 직접 insert/update 금지

-- 2) 시즌
create table if not exists public.campus_seasons (
  id text primary key,                    -- '2026-S2' 등
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.campus_seasons enable row level security;
drop policy if exists campus_seasons_select on public.campus_seasons;
create policy campus_seasons_select on public.campus_seasons
  for select to authenticated using (true);

-- 3) 영토 — 불규칙 territory (클라이언트 islandMap 과 같은 stable id)
create table if not exists public.campus_territories (
  id text primary key,                    -- '<seasonId>:<x>-<y>' (기존 타일 id 승계)
  season_id text not null references public.campus_seasons(id) on delete cascade,
  zone text not null,
  name text not null,
  owner_school_id text references public.campus_schools(id),
  challenger_school_id text references public.campus_schools(id),
  defense_score integer not null default 0 check (defense_score >= 0),
  challenge_score integer not null default 0 check (challenge_score >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists campus_territories_season_idx
  on public.campus_territories (season_id);

alter table public.campus_territories enable row level security;
drop policy if exists campus_territories_select on public.campus_territories;
create policy campus_territories_select on public.campus_territories
  for select to authenticated using (true);
-- 쓰기는 RPC 전용 (아래 apply_campus_contribution) — 직접 UPDATE 차단

-- 4) 기여 — eventId/sessionId 멱등. 자세 데이터 없음(종류·점수만)
create table if not exists public.campus_contributions (
  event_id text primary key,              -- 클라이언트 결정적 id (campus-session-<sid> 등)
  season_id text not null,
  school_id text not null references public.campus_schools(id),
  territory_id text references public.campus_territories(id),
  member_hash text not null,              -- 익명 식별 해시 (개인정보 아님)
  session_id text,
  kind text not null check (kind in
    ('session_completed','friend_session_completed','posture_recovered','stretch_completed')),
  points integer not null check (points between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists campus_contributions_school_idx
  on public.campus_contributions (season_id, school_id);

alter table public.campus_contributions enable row level security;
drop policy if exists campus_contributions_select on public.campus_contributions;
create policy campus_contributions_select on public.campus_contributions
  for select to authenticated using (true);

-- 5) 영토 이벤트 (경합 시작·점령·방어) — 화면 피드용
create table if not exists public.campus_territory_events (
  id uuid primary key default gen_random_uuid(),
  season_id text not null,
  territory_id text not null,
  event_type text not null check (event_type in ('contested','captured','defended')),
  school_id text references public.campus_schools(id),
  created_at timestamptz not null default now()
);

create index if not exists campus_territory_events_season_idx
  on public.campus_territory_events (season_id, created_at desc);

alter table public.campus_territory_events enable row level security;
drop policy if exists campus_territory_events_select on public.campus_territory_events;
create policy campus_territory_events_select on public.campus_territory_events
  for select to authenticated using (true);

-- 6) 커스텀 학교 등록 RPC — stable key 검증 + sanitize 는 클라이언트와 동일 규칙
create or replace function public.upsert_custom_school(
  p_id text, p_display_name text, p_short_name text, p_color text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_id !~ '^custom-[0-9a-f]{1,8}$' then raise exception 'invalid custom school id'; end if;
  insert into public.campus_schools (id, display_name, short_name, color, is_custom)
  values (p_id, trim(p_display_name), trim(p_short_name), p_color, true)
  on conflict (id) do update
    set display_name = excluded.display_name,
        short_name = excluded.short_name,
        color = excluded.color;
end; $$;

grant execute on function public.upsert_custom_school(text, text, text, text) to authenticated;

-- 7) 기여 + 원자적 점령 RPC — raw 점수만 사용, eventId 멱등
create or replace function public.apply_campus_contribution(
  p_event_id text,
  p_season_id text,
  p_school_id text,
  p_territory_id text,
  p_member_hash text,
  p_session_id text,
  p_kind text,
  p_points integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_territory public.campus_territories%rowtype;
  v_result text := 'accepted';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_points < 1 or p_points > 200 then raise exception 'invalid points'; end if;

  -- 멱등: 같은 event_id 는 1회만
  begin
    insert into public.campus_contributions
      (event_id, season_id, school_id, territory_id, member_hash, session_id, kind, points)
    values
      (p_event_id, p_season_id, p_school_id, p_territory_id, p_member_hash,
       p_session_id, p_kind, p_points);
  exception when unique_violation then
    return jsonb_build_object('result', 'duplicate_event');
  end;

  if p_territory_id is null then
    return jsonb_build_object('result', v_result);
  end if;

  select * into v_territory
    from public.campus_territories
   where id = p_territory_id
   for update;
  if not found then
    return jsonb_build_object('result', 'territory_not_found');
  end if;

  if v_territory.owner_school_id is null
     or v_territory.owner_school_id = p_school_id then
    -- 내 영토(또는 중립) 방어 보강 / 최초 점령
    if v_territory.owner_school_id is null then
      update public.campus_territories
         set owner_school_id = p_school_id,
             defense_score = p_points,
             challenger_school_id = null,
             challenge_score = 0,
             updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events (season_id, territory_id, event_type, school_id)
      values (p_season_id, p_territory_id, 'captured', p_school_id);
      v_result := 'captured';
    else
      update public.campus_territories
         set defense_score = defense_score + p_points, updated_at = now()
       where id = p_territory_id;
      v_result := 'defended';
      insert into public.campus_territory_events (season_id, territory_id, event_type, school_id)
      values (p_season_id, p_territory_id, 'defended', p_school_id);
    end if;
  else
    -- 도전: raw 점수 누적, 방어 점수를 넘으면 점령
    if v_territory.challenger_school_id is distinct from p_school_id then
      update public.campus_territories
         set challenger_school_id = p_school_id,
             challenge_score = p_points,
             updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events (season_id, territory_id, event_type, school_id)
      values (p_season_id, p_territory_id, 'contested', p_school_id);
      v_result := 'contested'
      ;
    else
      update public.campus_territories
         set challenge_score = challenge_score + p_points, updated_at = now()
       where id = p_territory_id
       returning * into v_territory;
      if v_territory.challenge_score > v_territory.defense_score then
        update public.campus_territories
           set owner_school_id = p_school_id,
               defense_score = v_territory.challenge_score,
               challenger_school_id = null,
               challenge_score = 0,
               updated_at = now()
         where id = p_territory_id;
        insert into public.campus_territory_events (season_id, territory_id, event_type, school_id)
        values (p_season_id, p_territory_id, 'captured', p_school_id);
        v_result := 'captured';
      else
        v_result := 'contested';
      end if;
    end if;
  end if;

  return jsonb_build_object('result', v_result);
end; $$;

grant execute on function public.apply_campus_contribution(
  text, text, text, text, text, text, text, integer
) to authenticated;

-- 8) 순위 뷰 — 보정 점수(참여 인원 보정)는 "순위 표시"에만 사용
create or replace view public.campus_school_rankings as
select
  season_id,
  school_id,
  sum(points)::bigint as total_contribution,
  count(distinct member_hash)::bigint as active_contributors,
  (sum(points) / sqrt(greatest(count(distinct member_hash), 1)))::numeric(12, 2)
    as adjusted_score
from public.campus_contributions
group by season_id, school_id;

grant select on public.campus_school_rankings to authenticated;

-- 9) Realtime publication — 영토·이벤트 변경을 두 기기에 즉시 전달
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename = 'campus_territories'
  ) then
    alter publication supabase_realtime add table public.campus_territories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename = 'campus_territory_events'
  ) then
    alter publication supabase_realtime add table public.campus_territory_events;
  end if;
end $$;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — friend-room 테이블은 건드리지 않음)
-- ============================================================================
-- alter publication supabase_realtime drop table public.campus_territory_events;
-- alter publication supabase_realtime drop table public.campus_territories;
-- drop view if exists public.campus_school_rankings;
-- drop function if exists public.apply_campus_contribution(text,text,text,text,text,text,text,integer);
-- drop function if exists public.upsert_custom_school(text,text,text,text);
-- drop table if exists public.campus_territory_events;
-- drop table if exists public.campus_contributions;
-- drop table if exists public.campus_territories;
-- drop table if exists public.campus_seasons;
-- drop table if exists public.campus_schools;
