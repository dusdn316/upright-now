-- ============================================================================
-- 20260727_campus_realtime_v2.sql (v2.3 — 공유 커스텀 학교·동시성 잠금·7일 쿨다운)
-- 캠퍼스 영토전 실시간 — 불규칙 36 territory 모델이 유일한 기준입니다.
--
-- Production 에 직접 실행하지 마세요. 멱등 / friend-room 무변경 /
-- 카메라·자세 데이터 컬럼 없음.
--
-- 시즌 규칙(클라이언트 season.ts 와 동일):
--   epoch 2026-01-05 00:00 UTC, 14일, id = 'season-' || (index+1)
--   ensure_active_campus_season() 이 시즌·36영토를 자동 준비(동시 호출 안전).
-- 점수 정책: 점수는 서버 CASE 로만 결정(클라이언트 인자 없음).
--   session_completed 100 / friend_session_completed 50 /
--   posture_recovered 20 / stretch_completed 20.
--   점령·경합·방어는 raw 점수, 순위 표시는 보정 점수(standings RPC).
-- 악용 제한: KST 일일 600점 상한 · recovery 세션당 5회·간격 20초 ·
--   완료류/회복은 sessionId 필수 · eventId 멱등.
-- 개인정보: campus_contributions 원장은 직접 SELECT 불가(집계 RPC 만),
--   campus_schools 의 created_by 는 directory 뷰에서 제외.
-- ============================================================================

-- 1) 학교
create table if not exists public.campus_schools (
  id text primary key,
  display_name text not null check (char_length(display_name) between 2 and 30),
  short_name text not null check (char_length(short_name) between 2 and 8),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_custom boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.campus_schools
  add column if not exists created_by uuid;

alter table public.campus_schools enable row level security;
-- created_by 노출 방지 — 테이블 직접 SELECT 를 막고 directory 뷰만 공개
drop policy if exists campus_schools_select on public.campus_schools;
revoke select on public.campus_schools from authenticated;

create or replace view public.campus_school_directory as
select id, display_name, short_name, color, is_custom
  from public.campus_schools;

grant select on public.campus_school_directory to authenticated;

-- 2) 소속 — 기여 위조 방지의 핵심
create table if not exists public.campus_memberships (
  user_id uuid primary key,
  school_id text not null references public.campus_schools(id),
  season_id text not null,
  selected_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  changes_in_season integer not null default 0
);

alter table public.campus_memberships enable row level security;
drop policy if exists campus_memberships_select_own on public.campus_memberships;
create policy campus_memberships_select_own on public.campus_memberships
  for select to authenticated using (user_id = auth.uid());

-- 3) 시즌
create table if not exists public.campus_seasons (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.campus_seasons enable row level security;
drop policy if exists campus_seasons_select on public.campus_seasons;
create policy campus_seasons_select on public.campus_seasons
  for select to authenticated using (true);

-- 4) 영토
create table if not exists public.campus_territories (
  id text primary key,
  season_id text not null references public.campus_seasons(id) on delete cascade,
  x integer not null,
  y integer not null,
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

-- 5) 기여 원장 — 직접 SELECT 금지 (다른 사용자의 member_hash·session_id·
--    event_id 열람 차단). 집계는 RPC(standings/my_contribution)로만.
create table if not exists public.campus_contributions (
  event_id text primary key,
  season_id text not null,
  school_id text not null references public.campus_schools(id),
  territory_id text references public.campus_territories(id),
  member_hash text not null,
  session_id text,
  kind text not null check (kind in
    ('session_completed','friend_session_completed','posture_recovered','stretch_completed')),
  points integer not null check (points between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists campus_contributions_school_idx
  on public.campus_contributions (season_id, school_id);
create index if not exists campus_contributions_member_day_idx
  on public.campus_contributions (member_hash, created_at);
-- 완료류 + 스트레칭 모두 (시즌·멤버·kind·sessionId) 1회 — eventId 를 바꿔도 차단
drop index if exists campus_contributions_session_once;
create unique index if not exists campus_contributions_session_once
  on public.campus_contributions (season_id, member_hash, kind, session_id)
  where session_id is not null
    and kind in ('session_completed','friend_session_completed','stretch_completed');

alter table public.campus_contributions enable row level security;
drop policy if exists campus_contributions_select on public.campus_contributions;
revoke select on public.campus_contributions from authenticated;

-- 6) 영토 이벤트
create table if not exists public.campus_territory_events (
  id uuid primary key default gen_random_uuid(),
  season_id text not null,
  territory_id text not null,
  kind text not null check (kind in ('contested','captured','defended')),
  from_school_id text references public.campus_schools(id),
  to_school_id text references public.campus_schools(id),
  created_at timestamptz not null default now()
);

create index if not exists campus_territory_events_season_idx
  on public.campus_territory_events (season_id, created_at desc);

alter table public.campus_territory_events enable row level security;
drop policy if exists campus_territory_events_select on public.campus_territory_events;
create policy campus_territory_events_select on public.campus_territory_events
  for select to authenticated using (true);

-- 7) 시즌 자동 전환 — 한 번 실행 후에도 14일마다 새 시즌·36영토 자동 준비.
--    advisory lock 으로 동시 호출에서도 중복 없이 안전합니다.
create or replace function public.ensure_active_campus_season()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_index integer := greatest(0, floor(
    extract(epoch from (now() - timestamptz '2026-01-05 00:00:00+00'))
    / (14 * 24 * 3600)
  ))::integer;
  v_season text := 'season-' || (v_index + 1);
  v_starts timestamptz :=
    timestamptz '2026-01-05 00:00:00+00' + (v_index * interval '14 days');
  r record;
begin
  perform pg_advisory_xact_lock(hashtext('campus-season-rollover'));

  insert into public.campus_seasons (id, name, starts_at, ends_at, status)
  values (v_season, '시즌 ' || (v_index + 1), v_starts,
          v_starts + interval '14 days', 'active')
  on conflict (id) do nothing;

  update public.campus_seasons
     set status = 'archived'
   where status = 'active' and ends_at <= now();

  for r in
    select * from (values
      (5, 3, 'plaza', '중앙광장 분수'),
      (6, 3, 'plaza', '중앙광장 시계탑'),
      (5, 4, 'plaza', '중앙광장 벤치숲'),
      (6, 4, 'plaza', '중앙광장 게시판'),
      (3, 1, 'library', '중앙도서관 본관'),
      (4, 1, 'library', '도서관 열람실'),
      (3, 2, 'library', '고서 서고'),
      (4, 2, 'library', '미디어 자료실'),
      (7, 1, 'lecture', '제1강의동'),
      (8, 1, 'lecture', '제2강의동'),
      (9, 1, 'lecture', '공학관'),
      (7, 2, 'lecture', '인문관'),
      (8, 2, 'lecture', '자연과학관'),
      (9, 2, 'lecture', '대형 강의실'),
      (2, 4, 'lawn', '동편 잔디광장'),
      (3, 4, 'lawn', '피크닉 잔디'),
      (2, 5, 'lawn', '버스킹 잔디'),
      (3, 5, 'lawn', '낮잠 언덕'),
      (7, 4, 'cafe', '카페거리 입구'),
      (8, 4, 'cafe', '골목 카페'),
      (9, 4, 'cafe', '디저트 가게'),
      (8, 5, 'cafe', '심야 카페'),
      (1, 1, 'dorm', '해오름 기숙사'),
      (1, 2, 'dorm', '달빛 기숙사'),
      (1, 3, 'dorm', '기숙사 라운지'),
      (2, 2, 'dorm', '기숙사 식당'),
      (5, 6, 'field', '대운동장'),
      (6, 6, 'field', '농구 코트'),
      (7, 6, 'field', '풋살장'),
      (6, 5, 'field', '트랙 관중석'),
      (10, 3, 'pond', '거북 연못'),
      (10, 4, 'pond', '수양버들 산책로'),
      (10, 5, 'pond', '징검다리'),
      (9, 6, 'pond', '연못 정자'),
      (4, 5, 'lawn', '벚꽃길'),
      (4, 6, 'field', '체육관 앞마당')
    ) as t(x, y, zone, name)
  loop
    insert into public.campus_territories (id, season_id, x, y, zone, name)
    values (v_season || ':' || r.x || '-' || r.y, v_season, r.x, r.y, r.zone, r.name)
    on conflict (id) do nothing;
  end loop;

  return v_season;
end; $fn$;

grant execute on function public.ensure_active_campus_season() to authenticated;

-- 8) 학교 선택/변경 — 시즌당 1회 서버 강제, 기여 이동 없음
create or replace function public.select_campus_school(p_school_id text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_season text := public.ensure_active_campus_season();
  v_row public.campus_memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.campus_schools where id = p_school_id) then
    raise exception 'unknown school';
  end if;

  select * into v_row from public.campus_memberships
   where user_id = auth.uid() for update;

  if not found then
    insert into public.campus_memberships (user_id, school_id, season_id)
    values (auth.uid(), p_school_id, v_season);
    return jsonb_build_object('result', 'selected');
  end if;

  if v_row.school_id = p_school_id then
    return jsonb_build_object('result', 'unchanged');
  end if;

  if v_row.season_id <> v_season then
    update public.campus_memberships
       set school_id = p_school_id, season_id = v_season,
           changes_in_season = 0, last_changed_at = now()
     where user_id = auth.uid();
    return jsonb_build_object('result', 'changed');
  end if;

  if v_row.changes_in_season >= 1 then
    return jsonb_build_object('result', 'change_limit');
  end if;

  -- 마지막 선택·변경 후 7일 이내에는 변경 불가 (화면 안내와 동일 규칙)
  if v_row.last_changed_at > now() - interval '7 days' then
    return jsonb_build_object(
      'result', 'change_cooldown',
      'next_allowed_at', v_row.last_changed_at + interval '7 days'
    );
  end if;

  update public.campus_memberships
     set school_id = p_school_id,
         changes_in_season = v_row.changes_in_season + 1,
         last_changed_at = now()
   where user_id = auth.uid();
  return jsonb_build_object('result', 'changed');
end; $fn$;

grant execute on function public.select_campus_school(text) to authenticated;

-- 9) 커스텀 학교 — 명시적 결과 반환, 타인 stable key 충돌은 실패로 보고
create or replace function public.upsert_custom_school(
  p_id text, p_display_name text, p_short_name text, p_color text
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_name text := trim(p_display_name);
  v_short text := trim(p_short_name);
  v_row public.campus_schools%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_id !~ '^custom-[0-9a-f]{1,8}$'
     or char_length(v_name) < 2 or char_length(v_name) > 30
     or char_length(v_short) < 2 or char_length(v_short) > 8
     or p_color !~ '^#[0-9a-fA-F]{6}$' then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into v_row from public.campus_schools where id = p_id for update;

  if not found then
    -- 같은 표시 이름의 다른 학교(프리셋 포함)와 충돌하면 생성하지 않음
    if exists (
      select 1 from public.campus_schools
       where lower(display_name) = lower(v_name) and id <> p_id
    ) then
      return jsonb_build_object('result', 'name_conflict');
    end if;
    insert into public.campus_schools
      (id, display_name, short_name, color, is_custom, created_by)
    values (p_id, v_name, v_short, p_color, true, auth.uid());
    return jsonb_build_object('result', 'created');
  end if;

  if v_row.created_by is distinct from auth.uid() then
    -- 같은 학교(같은 stable key + 같은 표시 이름)에 다른 사용자가 참여하는 것은
    -- 허용합니다. 표시 정보를 바꾸려는 시도만 소유권 충돌로 거부합니다.
    if lower(v_row.display_name) = lower(v_name) then
      return jsonb_build_object('result', 'existing');
    end if;
    return jsonb_build_object('result', 'ownership_conflict');
  end if;

  update public.campus_schools
     set display_name = v_name, short_name = v_short, color = p_color
   where id = p_id;
  return jsonb_build_object('result', 'updated');
end; $fn$;

grant execute on function public.upsert_custom_school(text, text, text, text) to authenticated;

-- 10) 기여 + 원자적 점령 — 점수·학교·멤버 전부 서버 결정
create or replace function public.apply_campus_contribution(
  p_event_id text,
  p_territory_id text,
  p_session_id text,
  p_kind text
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_season text := public.ensure_active_campus_season();
  v_school text;
  v_member_hash text;
  v_points integer;
  v_today_points integer;
  v_recovery_count integer;
  v_last_recovery timestamptz;
  v_territory public.campus_territories%rowtype;
  v_result text := 'accepted';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  -- 점수는 서버 CASE 로만 — 클라이언트가 임의 점수를 보낼 수 없음
  v_points := case p_kind
    when 'session_completed' then 100
    when 'friend_session_completed' then 50
    when 'posture_recovered' then 20
    when 'stretch_completed' then 20
    else null
  end;
  if v_points is null then
    return jsonb_build_object('result', 'invalid_kind');
  end if;

  -- 완료류·회복·스트레칭 모두 sessionId 필수
  if p_session_id is null or p_session_id = '' then
    return jsonb_build_object('result', 'session_required');
  end if;

  select school_id into v_school
    from public.campus_memberships where user_id = auth.uid();
  if v_school is null then
    return jsonb_build_object('result', 'no_membership');
  end if;

  v_member_hash := md5(auth.uid()::text || ':' || v_season);

  -- 동일 사용자의 동시 요청 직렬화 — 상한·간격 검사를 잠금 뒤에 수행해
  -- 서로 다른 eventId 동시 전송으로 600점·5회·20초 제한을 우회할 수 없습니다.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || v_season));

  -- KST 하루 최대 600점
  select coalesce(sum(points), 0) into v_today_points
    from public.campus_contributions
   where member_hash = v_member_hash
     and (created_at at time zone 'Asia/Seoul')::date
         = (now() at time zone 'Asia/Seoul')::date;
  if v_today_points + v_points > 600 then
    return jsonb_build_object('result', 'daily_cap');
  end if;

  -- 회복: 세션당 최대 5회 + 최소 20초 간격
  if p_kind = 'posture_recovered' then
    select count(*), max(created_at)
      into v_recovery_count, v_last_recovery
      from public.campus_contributions
     where member_hash = v_member_hash
       and kind = 'posture_recovered'
       and session_id = p_session_id;
    if v_recovery_count >= 5 then
      return jsonb_build_object('result', 'recovery_cap');
    end if;
    if v_last_recovery is not null
       and v_last_recovery > now() - interval '20 seconds' then
      return jsonb_build_object('result', 'recovery_cooldown');
    end if;
  end if;

  begin
    insert into public.campus_contributions
      (event_id, season_id, school_id, territory_id, member_hash, session_id, kind, points)
    values
      (p_event_id, v_season, v_school, p_territory_id, v_member_hash,
       p_session_id, p_kind, v_points);
  exception when unique_violation then
    return jsonb_build_object('result', 'duplicate_event');
  end;

  if p_territory_id is null then
    return jsonb_build_object('result', v_result, 'points', v_points);
  end if;

  select * into v_territory
    from public.campus_territories
   where id = p_territory_id and season_id = v_season
   for update;
  if not found then
    return jsonb_build_object('result', 'territory_not_found', 'points', v_points);
  end if;

  if v_territory.owner_school_id is null
     or v_territory.owner_school_id = v_school then
    if v_territory.owner_school_id is null then
      update public.campus_territories
         set owner_school_id = v_school, defense_score = v_points,
             challenger_school_id = null, challenge_score = 0, updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events
        (season_id, territory_id, kind, from_school_id, to_school_id)
      values (v_season, p_territory_id, 'captured', null, v_school);
      v_result := 'captured';
    else
      update public.campus_territories
         set defense_score = defense_score + v_points, updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events
        (season_id, territory_id, kind, from_school_id, to_school_id)
      values (v_season, p_territory_id, 'defended', v_school, v_school);
      v_result := 'defended';
    end if;
  else
    if v_territory.challenger_school_id is distinct from v_school then
      update public.campus_territories
         set challenger_school_id = v_school, challenge_score = v_points, updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events
        (season_id, territory_id, kind, from_school_id, to_school_id)
      values (v_season, p_territory_id, 'contested', v_territory.owner_school_id, v_school);
      v_result := 'contested';
    else
      update public.campus_territories
         set challenge_score = challenge_score + v_points, updated_at = now()
       where id = p_territory_id
       returning * into v_territory;
      if v_territory.challenge_score > v_territory.defense_score then
        update public.campus_territories
           set owner_school_id = v_school, defense_score = v_territory.challenge_score,
               challenger_school_id = null, challenge_score = 0, updated_at = now()
         where id = p_territory_id;
        insert into public.campus_territory_events
          (season_id, territory_id, kind, from_school_id, to_school_id)
        values (v_season, p_territory_id, 'captured', v_territory.owner_school_id, v_school);
        v_result := 'captured';
      else
        v_result := 'contested';
      end if;
    end if;
  end if;

  return jsonb_build_object('result', v_result, 'points', v_points);
end; $fn$;

grant execute on function public.apply_campus_contribution(text, text, text, text)
  to authenticated;
-- 구버전 시그니처(p_points 포함) 잔재 제거
drop function if exists public.apply_campus_contribution(text, text, text, text, integer);

-- 11) 순위(보정 점수, 표시 전용) + 내 기여 — 원장 접근은 이 RPC 로만
create or replace function public.campus_season_standings(p_season_id text)
returns table (
  school_id text,
  total_contribution bigint,
  active_contributors bigint,
  adjusted_score numeric,
  tiles bigint
) language sql stable security definer set search_path = public as $fn$
  select
    c.school_id,
    sum(c.points)::bigint,
    count(distinct c.member_hash)::bigint,
    (sum(c.points) / sqrt(greatest(count(distinct c.member_hash), 1)))::numeric(12,2),
    (select count(*) from public.campus_territories t
      where t.season_id = p_season_id and t.owner_school_id = c.school_id)::bigint
  from public.campus_contributions c
  where c.season_id = p_season_id
  group by c.school_id
  order by 4 desc;
$fn$;

grant execute on function public.campus_season_standings(text) to authenticated;

create or replace function public.campus_my_contribution(p_season_id text)
returns bigint language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(points), 0)::bigint
    from public.campus_contributions
   where season_id = p_season_id
     and member_hash = md5(auth.uid()::text || ':' || p_season_id);
$fn$;

grant execute on function public.campus_my_contribution(text) to authenticated;

-- 12) Realtime publication
do $do$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'campus_territories'
  ) then
    alter publication supabase_realtime add table public.campus_territories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'campus_territory_events'
  ) then
    alter publication supabase_realtime add table public.campus_territory_events;
  end if;
end $do$;

-- 13) SEED — 학교 프리셋 upsert + 활성 시즌·36영토 준비(ensure 호출)
insert into public.campus_schools (id, display_name, short_name, color, is_custom)
values
    ('snu', '서울대학교', '서울대', '#2B4C7E', false),
    ('yonsei', '연세대학교', '연세대', '#1D4E89', false),
    ('korea', '고려대학교', '고려대', '#8E2438', false),
    ('sogang', '서강대학교', '서강대', '#A24936', false),
    ('skku', '성균관대학교', '성균관대', '#1E6B5E', false),
    ('hanyang', '한양대학교', '한양대', '#2F4F82', false),
    ('cau', '중앙대학교', '중앙대', '#39609E', false),
    ('khu', '경희대학교', '경희대', '#22603C', false),
    ('hufs', '한국외국어대학교', '외대', '#2C6E7F', false),
    ('uos', '서울시립대학교', '시립대', '#4A5CA8', false)
on conflict (id) do update
  set display_name = excluded.display_name,
      short_name = excluded.short_name,
      color = excluded.color;

select public.ensure_active_campus_season();

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — friend-room 테이블은 건드리지 않음)
-- ============================================================================
-- alter publication supabase_realtime drop table public.campus_territory_events;
-- alter publication supabase_realtime drop table public.campus_territories;
-- drop function if exists public.campus_my_contribution(text);
-- drop function if exists public.campus_season_standings(text);
-- drop function if exists public.apply_campus_contribution(text,text,text,text);
-- drop function if exists public.upsert_custom_school(text,text,text,text);
-- drop function if exists public.select_campus_school(text);
-- drop function if exists public.ensure_active_campus_season();
-- drop view if exists public.campus_school_directory;
-- drop table if exists public.campus_territory_events;
-- drop table if exists public.campus_contributions;
-- drop table if exists public.campus_territories;
-- drop table if exists public.campus_seasons;
-- drop table if exists public.campus_memberships;
-- drop table if exists public.campus_schools;
