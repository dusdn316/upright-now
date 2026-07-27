-- ============================================================================
-- 20260727_campus_final_grid_realtime.sql (RC2 최종 — 단일 기준 migration)
--
-- 이 파일 하나가 이번 마지막 캠퍼스 변경의 단일 기준입니다.
-- 기존 4개 migration(20260726 2건 + 20260727 2건) 위에 실행하며,
-- 그것들을 다시 실행할 필요가 없습니다.
--
-- 포함:
--   1) 96(12×8) 영토 seed — 기존 36 보존 + 누락 60 추가, 미래 시즌도 96 보장
--   2) 안전한 학교 디렉터리 테이블(campus_school_directory_entries)
--      + campus_schools 동기화 trigger + 기존 학교 backfill
--   3) apply_campus_contribution v3 — 권위 응답(authoritativeMyContribution·
--      updatedTerritory·serverTime) + duplicate_event/duplicate_session 구분
--   4) campus_my_membership() — 다른 기기 membership 복원용
--   5) Realtime publication: territories · territory_events · directory_entries
--
-- 안전 규칙: 멱등 / 기존 영토 owner·challenger·defense·challenge 불변 /
--   contributions·events 불변 / 원장 공개 SELECT 없음 / created_by 비노출.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 96 영토 seed — ensure_active_campus_season() 교체
--    (클라이언트 campusGridSeedManifest.json 과 정확히 같은 96행)
-- ---------------------------------------------------------------------------
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

  -- 96 = 12열(x 0..11) × 8행(y 0..7). 기존 36행의 zone·name·점수·소유권은
  -- 그대로 두고(on conflict do nothing), 없는 칸만 추가합니다.
  for r in
    select * from (values
      (0, 0, 'dorm', '기숙사 쉼터'),
      (1, 0, 'dorm', '기숙사 골목'),
      (2, 0, 'library', '도서관 쉼터'),
      (3, 0, 'library', '도서관 골목'),
      (4, 0, 'library', '도서관 모퉁이'),
      (5, 0, 'library', '도서관 샛길'),
      (6, 0, 'lecture', '강의동 쉼터'),
      (7, 0, 'lecture', '강의동 골목'),
      (8, 0, 'lecture', '강의동 모퉁이'),
      (9, 0, 'lecture', '강의동 샛길'),
      (10, 0, 'lecture', '강의동 뜰'),
      (11, 0, 'lecture', '강의동 테라스'),
      (0, 1, 'dorm', '기숙사 모퉁이'),
      (1, 1, 'dorm', '해오름 기숙사'),
      (2, 1, 'library', '도서관 뜰'),
      (3, 1, 'library', '중앙도서관 본관'),
      (4, 1, 'library', '도서관 열람실'),
      (5, 1, 'library', '도서관 테라스'),
      (6, 1, 'lecture', '강의동 언덕길'),
      (7, 1, 'lecture', '제1강의동'),
      (8, 1, 'lecture', '제2강의동'),
      (9, 1, 'lecture', '공학관'),
      (10, 1, 'lecture', '강의동 벤치'),
      (11, 1, 'lecture', '강의동 정원'),
      (0, 2, 'dorm', '기숙사 샛길'),
      (1, 2, 'dorm', '달빛 기숙사'),
      (2, 2, 'dorm', '기숙사 식당'),
      (3, 2, 'library', '고서 서고'),
      (4, 2, 'library', '미디어 자료실'),
      (5, 2, 'plaza', '중앙광장 쉼터'),
      (6, 2, 'plaza', '중앙광장 골목'),
      (7, 2, 'lecture', '인문관'),
      (8, 2, 'lecture', '자연과학관'),
      (9, 2, 'lecture', '대형 강의실'),
      (10, 2, 'lecture', '강의동 큰길'),
      (11, 2, 'lecture', '강의동 작은길'),
      (0, 3, 'dorm', '기숙사 뜰'),
      (1, 3, 'dorm', '기숙사 라운지'),
      (2, 3, 'lawn', '잔디광장 쉼터'),
      (3, 3, 'library', '도서관 언덕길'),
      (4, 3, 'plaza', '중앙광장 모퉁이'),
      (5, 3, 'plaza', '중앙광장 분수'),
      (6, 3, 'plaza', '중앙광장 시계탑'),
      (7, 3, 'plaza', '중앙광장 샛길'),
      (8, 3, 'lecture', '강의동 광장 끝'),
      (9, 3, 'lecture', '강의동 쉼터 2'),
      (10, 3, 'pond', '거북 연못'),
      (11, 3, 'pond', '연못가 쉼터'),
      (0, 4, 'lawn', '잔디광장 골목'),
      (1, 4, 'lawn', '잔디광장 모퉁이'),
      (2, 4, 'lawn', '동편 잔디광장'),
      (3, 4, 'lawn', '피크닉 잔디'),
      (4, 4, 'plaza', '중앙광장 뜰'),
      (5, 4, 'plaza', '중앙광장 벤치숲'),
      (6, 4, 'plaza', '중앙광장 게시판'),
      (7, 4, 'cafe', '카페거리 입구'),
      (8, 4, 'cafe', '골목 카페'),
      (9, 4, 'cafe', '디저트 가게'),
      (10, 4, 'pond', '수양버들 산책로'),
      (11, 4, 'pond', '연못가 골목'),
      (0, 5, 'lawn', '잔디광장 샛길'),
      (1, 5, 'lawn', '잔디광장 뜰'),
      (2, 5, 'lawn', '버스킹 잔디'),
      (3, 5, 'lawn', '낮잠 언덕'),
      (4, 5, 'lawn', '벚꽃길'),
      (5, 5, 'plaza', '중앙광장 테라스'),
      (6, 5, 'field', '트랙 관중석'),
      (7, 5, 'cafe', '카페거리 쉼터'),
      (8, 5, 'cafe', '심야 카페'),
      (9, 5, 'cafe', '카페거리 골목'),
      (10, 5, 'pond', '징검다리'),
      (11, 5, 'pond', '연못가 모퉁이'),
      (0, 6, 'lawn', '잔디광장 테라스'),
      (1, 6, 'lawn', '잔디광장 언덕길'),
      (2, 6, 'lawn', '잔디광장 벤치'),
      (3, 6, 'lawn', '잔디광장 정원'),
      (4, 6, 'field', '체육관 앞마당'),
      (5, 6, 'field', '대운동장'),
      (6, 6, 'field', '농구 코트'),
      (7, 6, 'field', '풋살장'),
      (8, 6, 'cafe', '카페거리 모퉁이'),
      (9, 6, 'pond', '연못 정자'),
      (10, 6, 'pond', '연못가 샛길'),
      (11, 6, 'pond', '연못가 뜰'),
      (0, 7, 'lawn', '잔디광장 큰길'),
      (1, 7, 'lawn', '잔디광장 작은길'),
      (2, 7, 'lawn', '잔디광장 광장 끝'),
      (3, 7, 'lawn', '잔디광장 쉼터 2'),
      (4, 7, 'field', '운동장 쉼터'),
      (5, 7, 'field', '운동장 골목'),
      (6, 7, 'field', '운동장 모퉁이'),
      (7, 7, 'field', '운동장 샛길'),
      (8, 7, 'cafe', '카페거리 샛길'),
      (9, 7, 'pond', '연못가 테라스'),
      (10, 7, 'pond', '연못가 언덕길'),
      (11, 7, 'pond', '연못가 벤치')
    ) as t(x, y, zone, name)
  loop
    insert into public.campus_territories (id, season_id, x, y, zone, name)
    values (v_season || ':' || r.x || '-' || r.y, v_season, r.x, r.y, r.zone, r.name)
    on conflict (id) do nothing;
  end loop;

  return v_season;
end; $fn$;

grant execute on function public.ensure_active_campus_season() to authenticated;

-- 현재 활성 시즌에 즉시 96칸을 보장합니다 (재실행해도 96 초과 없음 — PK).
select public.ensure_active_campus_season();

-- ---------------------------------------------------------------------------
-- 2) 안전한 학교 디렉터리 — Realtime 가능해야 하므로 뷰가 아니라 실테이블.
--    created_by 는 이 테이블에 존재하지 않습니다.
-- ---------------------------------------------------------------------------
create table if not exists public.campus_school_directory_entries (
  id text primary key,
  display_name text not null,
  short_name text not null,
  color text not null,
  is_custom boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.campus_school_directory_entries enable row level security;

drop policy if exists campus_directory_select on public.campus_school_directory_entries;
create policy campus_directory_select on public.campus_school_directory_entries
  for select to authenticated using (true);
-- 쓰기는 trigger(soruce of truth = campus_schools)만 — 클라이언트 직접 쓰기 금지
revoke insert, update, delete on public.campus_school_directory_entries
  from authenticated, anon;

create or replace function public.sync_campus_school_directory()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    delete from public.campus_school_directory_entries where id = old.id;
    return old;
  end if;
  insert into public.campus_school_directory_entries
    (id, display_name, short_name, color, is_custom, updated_at)
  values (new.id, new.display_name, new.short_name, new.color, new.is_custom, now())
  on conflict (id) do update
    set display_name = excluded.display_name,
        short_name = excluded.short_name,
        color = excluded.color,
        is_custom = excluded.is_custom,
        updated_at = now();
  return new;
end; $fn$;

drop trigger if exists campus_schools_directory_sync on public.campus_schools;
create trigger campus_schools_directory_sync
  after insert or update or delete on public.campus_schools
  for each row execute function public.sync_campus_school_directory();

-- 기존 학교(프리셋 + 이미 등록된 커스텀) backfill — created_by 는 복사하지 않음
insert into public.campus_school_directory_entries
  (id, display_name, short_name, color, is_custom, updated_at)
select id, display_name, short_name, color, is_custom, now()
  from public.campus_schools
on conflict (id) do update
  set display_name = excluded.display_name,
      short_name = excluded.short_name,
      color = excluded.color,
      is_custom = excluded.is_custom,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) apply_campus_contribution v3 — 권위 응답.
--    점수 정책·상한·잠금은 v2.3 과 동일: 서버 CASE(100/50/20/20) ·
--    KST 일일 600 · 회복 세션당 5회·20초 · sessionId 필수 ·
--    per-user advisory lock · eventId/sessionId 멱등.
-- ---------------------------------------------------------------------------
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
  v_constraint text;
  v_my_total bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  v_points := case p_kind
    when 'session_completed' then 100
    when 'friend_session_completed' then 50
    when 'posture_recovered' then 20
    when 'stretch_completed' then 20
    else null
  end;
  if v_points is null then
    return jsonb_build_object('result', 'invalid_kind', 'eventId', p_event_id,
      'serverTime', now());
  end if;

  if p_session_id is null or p_session_id = '' then
    return jsonb_build_object('result', 'session_required', 'eventId', p_event_id,
      'serverTime', now());
  end if;

  select school_id into v_school
    from public.campus_memberships where user_id = auth.uid();
  if v_school is null then
    return jsonb_build_object('result', 'no_membership', 'eventId', p_event_id,
      'serverTime', now());
  end if;

  v_member_hash := md5(auth.uid()::text || ':' || v_season);

  -- 동일 사용자의 동시 요청 직렬화 — 상한 검사를 잠금 뒤에 수행합니다.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || v_season));

  select coalesce(sum(points), 0) into v_my_total
    from public.campus_contributions
   where season_id = v_season and member_hash = v_member_hash;

  -- KST 하루 최대 600점
  select coalesce(sum(points), 0) into v_today_points
    from public.campus_contributions
   where member_hash = v_member_hash
     and (created_at at time zone 'Asia/Seoul')::date
         = (now() at time zone 'Asia/Seoul')::date;
  if v_today_points + v_points > 600 then
    return jsonb_build_object('result', 'daily_cap', 'eventId', p_event_id,
      'authoritativeMyContribution', v_my_total, 'serverTime', now());
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
      return jsonb_build_object('result', 'recovery_cap', 'eventId', p_event_id,
        'authoritativeMyContribution', v_my_total, 'serverTime', now());
    end if;
    if v_last_recovery is not null
       and v_last_recovery > now() - interval '20 seconds' then
      return jsonb_build_object('result', 'recovery_cooldown', 'eventId', p_event_id,
        'authoritativeMyContribution', v_my_total, 'serverTime', now());
    end if;
  end if;

  begin
    insert into public.campus_contributions
      (event_id, season_id, school_id, territory_id, member_hash, session_id, kind, points)
    values
      (p_event_id, v_season, v_school, p_territory_id, v_member_hash,
       p_session_id, p_kind, v_points);
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    return jsonb_build_object(
      'result',
      case when v_constraint = 'campus_contributions_session_once'
           then 'duplicate_session' else 'duplicate_event' end,
      'eventId', p_event_id,
      'authoritativeMyContribution', v_my_total,
      'serverTime', now());
  end;

  v_my_total := v_my_total + v_points;

  if p_territory_id is null then
    return jsonb_build_object('result', v_result, 'acceptedPoints', v_points,
      'points', v_points, 'eventId', p_event_id, 'territoryId', null,
      'authoritativeMyContribution', v_my_total, 'updatedTerritory', null,
      'serverTime', now());
  end if;

  select * into v_territory
    from public.campus_territories
   where id = p_territory_id and season_id = v_season
   for update;
  if not found then
    return jsonb_build_object('result', 'territory_not_found',
      'acceptedPoints', v_points, 'points', v_points, 'eventId', p_event_id,
      'territoryId', p_territory_id,
      'authoritativeMyContribution', v_my_total, 'updatedTerritory', null,
      'serverTime', now());
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

  -- 반영 직후 영토 상태를 함께 돌려줍니다 (클라이언트 즉시 merge 용)
  select * into v_territory
    from public.campus_territories where id = p_territory_id;

  return jsonb_build_object(
    'result', v_result,
    'acceptedPoints', v_points,
    'points', v_points,
    'eventId', p_event_id,
    'territoryId', p_territory_id,
    'authoritativeMyContribution', v_my_total,
    'updatedTerritory', to_jsonb(v_territory),
    'serverTime', now());
end; $fn$;

grant execute on function public.apply_campus_contribution(text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4) 내 membership 조회 — 다른 기기·저장소 유실 복원용 (자기 것만)
-- ---------------------------------------------------------------------------
create or replace function public.campus_my_membership()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select case when m.user_id is null then null
    else jsonb_build_object(
      'school_id', m.school_id,
      'season_id', m.season_id,
      'selected_at', m.selected_at,
      'last_changed_at', m.last_changed_at,
      'changes_in_season', m.changes_in_season)
    end
  from (select 1) as one
  left join public.campus_memberships m on m.user_id = auth.uid();
$fn$;

grant execute on function public.campus_my_membership() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Realtime publication — 세 테이블 모두 등록 (이미 있으면 건너뜀)
-- ---------------------------------------------------------------------------
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
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename = 'campus_school_directory_entries'
  ) then
    alter publication supabase_realtime
      add table public.campus_school_directory_entries;
  end if;
end $do$;

-- ---------------------------------------------------------------------------
-- 6) 실행 확인 — 아래 결과를 눈으로 확인하세요.
--    · active_season / active_territory_count = 96
--    · directory_count ≥ 10 (프리셋 + 커스텀)
--    · publication_tables 에 세 테이블
--    · preserved_owned = 이 migration 직전에 점령돼 있던 영토 수와 같아야 함
-- ---------------------------------------------------------------------------
select
  (select id from public.campus_seasons where status = 'active'
    order by starts_at desc limit 1)                                as active_season,
  (select count(*) from public.campus_territories t
    where t.season_id = (select id from public.campus_seasons
      where status = 'active' order by starts_at desc limit 1))     as active_territory_count,
  (select count(*) from public.campus_school_directory_entries)    as directory_count,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename in ('campus_territories','campus_territory_events',
                        'campus_school_directory_entries'))         as publication_tables,
  (select count(*) from public.campus_territories t
    where t.season_id = (select id from public.campus_seasons
      where status = 'active' order by starts_at desc limit 1)
      and t.owner_school_id is not null)                            as preserved_owned;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — 영토·기여·학교 데이터는 삭제하지 않음)
-- ============================================================================
-- drop function if exists public.campus_my_membership();
-- alter publication supabase_realtime drop table public.campus_school_directory_entries;
-- drop trigger if exists campus_schools_directory_sync on public.campus_schools;
-- drop function if exists public.sync_campus_school_directory();
-- drop table if exists public.campus_school_directory_entries;
-- (apply_campus_contribution 은 20260727_campus_realtime_v2.sql 의 v2.3 정의를
--  다시 실행하면 이전 응답 형태로 돌아갑니다. 96 영토 seed 는 데이터 추가일 뿐
--  이므로 되돌릴 필요가 없고, 삭제하지 않는 것이 안전합니다.)
