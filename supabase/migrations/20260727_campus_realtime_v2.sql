-- ============================================================================
-- 20260727_campus_realtime_v2.sql (v2.1 — 멤버십 보안·시드 포함 단일 기준)
-- 캠퍼스 영토전 실시간 — 불규칙 36 territory 모델이 유일한 기준입니다.
-- (구 v1 사각 타일 테이블·RPC 경로는 클라이언트에서 완전히 제거됨)
--
-- Production 에 직접 실행하지 마세요. 멱등(여러 번 실행 안전) /
-- friend-room 테이블·RLS 무변경 / 카메라·자세 데이터 컬럼 없음.
--
-- 시즌 규칙(클라이언트 season.ts 와 동일):
--   epoch 2026-01-05 00:00 UTC, 14일 단위, id = 'season-' || (index+1)
-- 점수 정책: 점령·경합·방어는 raw points, 순위 표시는 보정 점수
--   total / sqrt(max(activeContributors,1)) (campus_season_standings)
-- ============================================================================

-- 1) 학교 — 프리셋 + 사용자 정의(비공식, stable key = 'custom-<hash>')
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
drop policy if exists campus_schools_select on public.campus_schools;
create policy campus_schools_select on public.campus_schools
  for select to authenticated using (true);

-- 2) 소속 — 기여 위조 방지의 핵심. school_id 는 항상 서버가 여기서 읽습니다.
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
-- 쓰기는 select_campus_school RPC 로만

-- 3) 시즌 — 클라이언트 SeasonRow(name/status/starts_at/ends_at)와 동일 컬럼
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

-- 현재 활성 시즌 조회 — 코드와 같은 규칙의 단일 출처
create or replace function public.campus_active_season_id()
returns text language sql stable security definer set search_path = public as $fn$
  select id from public.campus_seasons
   where status = 'active' and now() >= starts_at and now() < ends_at
   order by starts_at desc
   limit 1;
$fn$;

grant execute on function public.campus_active_season_id() to authenticated;

-- 4) 영토 — 불규칙 territory. id = '<seasonId>:<x>-<y>' (클라이언트 tileId 와 동일)
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

-- 5) 기여 — event_id PK 멱등 + session_id 완료 중복 차단. 자세 데이터 없음
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
create unique index if not exists campus_contributions_session_once
  on public.campus_contributions (season_id, member_hash, kind, session_id)
  where session_id is not null and kind in ('session_completed','friend_session_completed');

alter table public.campus_contributions enable row level security;
drop policy if exists campus_contributions_select on public.campus_contributions;
create policy campus_contributions_select on public.campus_contributions
  for select to authenticated using (true);

-- 6) 영토 이벤트 — 클라이언트 TileEventRow(kind/from/to)와 동일 컬럼
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

-- 7) 학교 선택/변경 RPC — 시즌당 1회 변경 제한을 서버가 강제.
--    이전 학교의 기여는 이동하지 않습니다(원장 불변).
create or replace function public.select_campus_school(p_school_id text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_season text := public.campus_active_season_id();
  v_row public.campus_memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if v_season is null then raise exception 'no active season'; end if;
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

  -- 시즌이 바뀌었으면 변경 카운터 리셋
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

  update public.campus_memberships
     set school_id = p_school_id,
         changes_in_season = v_row.changes_in_season + 1,
         last_changed_at = now()
   where user_id = auth.uid();
  return jsonb_build_object('result', 'changed');
end; $fn$;

grant execute on function public.select_campus_school(text) to authenticated;

-- 8) 커스텀 학교 등록 — 최초 생성자만 수정 가능(소유권), 서버측 값 검증
create or replace function public.upsert_custom_school(
  p_id text, p_display_name text, p_short_name text, p_color text
) returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_name text := trim(p_display_name);
  v_short text := trim(p_short_name);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_id !~ '^custom-[0-9a-f]{1,8}$' then raise exception 'invalid custom school id'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 30 then
    raise exception 'invalid school name';
  end if;
  if char_length(v_short) < 2 or char_length(v_short) > 8 then
    raise exception 'invalid short name';
  end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'invalid color'; end if;

  insert into public.campus_schools (id, display_name, short_name, color, is_custom, created_by)
  values (p_id, v_name, v_short, p_color, true, auth.uid())
  on conflict (id) do update
    set display_name = excluded.display_name,
        short_name = excluded.short_name,
        color = excluded.color
    where campus_schools.created_by = auth.uid();
  -- 다른 사용자의 커스텀 학교면 위 update 는 조용히 0행 — 덮어쓰기 불가
end; $fn$;

grant execute on function public.upsert_custom_school(text, text, text, text) to authenticated;

-- 9) 기여 + 원자적 점령 — school/member 는 서버가 결정 (클라이언트 인자 없음)
create or replace function public.apply_campus_contribution(
  p_event_id text,
  p_territory_id text,
  p_session_id text,
  p_kind text,
  p_points integer
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_season text := public.campus_active_season_id();
  v_school text;
  v_member_hash text;
  v_territory public.campus_territories%rowtype;
  v_result text := 'accepted';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if v_season is null then raise exception 'no active season'; end if;
  if p_points < 1 or p_points > 200 then raise exception 'invalid points'; end if;

  -- 소속은 서버가 조회 — 다른 학교로 기여 위조 불가
  select school_id into v_school
    from public.campus_memberships where user_id = auth.uid();
  if v_school is null then
    return jsonb_build_object('result', 'no_membership');
  end if;

  -- 익명 멤버 해시도 서버 파생 — 클라이언트 입력을 믿지 않음
  v_member_hash := md5(auth.uid()::text || ':' || v_season);

  begin
    insert into public.campus_contributions
      (event_id, season_id, school_id, territory_id, member_hash, session_id, kind, points)
    values
      (p_event_id, v_season, v_school, p_territory_id, v_member_hash,
       nullif(p_session_id, ''), p_kind, p_points);
  exception when unique_violation then
    return jsonb_build_object('result', 'duplicate_event');
  end;

  if p_territory_id is null then
    return jsonb_build_object('result', v_result, 'points', p_points);
  end if;

  select * into v_territory
    from public.campus_territories
   where id = p_territory_id and season_id = v_season
   for update;
  if not found then
    return jsonb_build_object('result', 'territory_not_found');
  end if;

  if v_territory.owner_school_id is null
     or v_territory.owner_school_id = v_school then
    if v_territory.owner_school_id is null then
      update public.campus_territories
         set owner_school_id = v_school, defense_score = p_points,
             challenger_school_id = null, challenge_score = 0, updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events
        (season_id, territory_id, kind, from_school_id, to_school_id)
      values (v_season, p_territory_id, 'captured', null, v_school);
      v_result := 'captured';
    else
      update public.campus_territories
         set defense_score = defense_score + p_points, updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events
        (season_id, territory_id, kind, from_school_id, to_school_id)
      values (v_season, p_territory_id, 'defended', v_school, v_school);
      v_result := 'defended';
    end if;
  else
    if v_territory.challenger_school_id is distinct from v_school then
      update public.campus_territories
         set challenger_school_id = v_school, challenge_score = p_points, updated_at = now()
       where id = p_territory_id;
      insert into public.campus_territory_events
        (season_id, territory_id, kind, from_school_id, to_school_id)
      values (v_season, p_territory_id, 'contested', v_territory.owner_school_id, v_school);
      v_result := 'contested';
    else
      update public.campus_territories
         set challenge_score = challenge_score + p_points, updated_at = now()
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

  return jsonb_build_object('result', v_result, 'points', p_points);
end; $fn$;

grant execute on function public.apply_campus_contribution(text, text, text, text, integer)
  to authenticated;

-- 10) 순위 — 보정 점수(표시 전용) + 점령 타일 수. 클라이언트 StandingRow 와 동일
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

-- 11) Realtime publication — territories·territory_events 두 테이블 구독
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

-- ============================================================================
-- 12) SEED — 학교 프리셋 + 활성 시즌 + 36 territory (모두 upsert, 중복 없음)
--     territory 좌표·zone·name 은 클라이언트 islandMap SPOTS 에서 생성됨
--     (src/features/campus/territorySeedManifest.json 과 단위 테스트로 고정)
-- ============================================================================
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

do $seed$
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
  -- 활성 시즌 1개 (클라이언트 seasonAt 과 같은 id·경계)
  insert into public.campus_seasons (id, name, starts_at, ends_at, status)
  values (v_season, '시즌 ' || (v_index + 1), v_starts, v_starts + interval '14 days', 'active')
  on conflict (id) do nothing;

  -- 지난 시즌 자동 보관
  update public.campus_seasons
     set status = 'archived'
   where status = 'active' and ends_at <= now();

  -- 36 territory — 초기 정책: 중립(owner/challenger null), 점수 0
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
end $seed$;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — friend-room 테이블은 건드리지 않음)
-- ============================================================================
-- alter publication supabase_realtime drop table public.campus_territory_events;
-- alter publication supabase_realtime drop table public.campus_territories;
-- drop function if exists public.campus_my_contribution(text);
-- drop function if exists public.campus_season_standings(text);
-- drop function if exists public.apply_campus_contribution(text,text,text,text,integer);
-- drop function if exists public.upsert_custom_school(text,text,text,text);
-- drop function if exists public.select_campus_school(text);
-- drop function if exists public.campus_active_season_id();
-- drop table if exists public.campus_territory_events;
-- drop table if exists public.campus_contributions;
-- drop table if exists public.campus_territories;
-- drop table if exists public.campus_seasons;
-- drop table if exists public.campus_memberships;
-- drop table if exists public.campus_schools;
