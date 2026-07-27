-- ============================================================================
-- 20260727_rc2_smoke_cleanup.sql — RC2 라이브 검증 데이터 1회용 정리
-- (마이그레이션 아님 — Supabase SQL Editor 에서 수동 1회 실행)
--
-- 대상(이것만 삭제):
--   · 학교 custom-8d925212  "RC2검증대학교"      (검증 사용자 2명, 기여 40점)
--   · 학교 custom-e8ab11b6  "RC2검증보조대학교"  (Realtime 전파 확인용, 기여 0)
--   · session/event id 가 'rc2-smoke-' 로 시작하는 기여
-- 다른 학교·사용자·기여·영토 기록은 건드리지 않습니다.
-- ============================================================================
begin;

-- 삭제 전 개수 확인
select
  (select count(*) from public.campus_contributions
    where school_id in ('custom-8d925212','custom-e8ab11b6')
       or session_id like 'rc2-smoke-%' or event_id like 'rc2-smoke-%') as contributions_before,
  (select count(*) from public.campus_memberships
    where school_id in ('custom-8d925212','custom-e8ab11b6'))           as memberships_before,
  (select count(*) from public.campus_territories
    where owner_school_id  in ('custom-8d925212','custom-e8ab11b6')
       or challenger_school_id in ('custom-8d925212','custom-e8ab11b6')) as territories_before,
  (select count(*) from public.campus_school_directory_entries
    where id in ('custom-8d925212','custom-e8ab11b6'))                  as directory_before;

-- 1) 검증 학교가 점령·경합 중인 영토를 중립으로 되돌림
update public.campus_territories
   set owner_school_id = null, defense_score = 0,
       challenger_school_id = null, challenge_score = 0, updated_at = now()
 where owner_school_id in ('custom-8d925212','custom-e8ab11b6');
update public.campus_territories
   set challenger_school_id = null, challenge_score = 0, updated_at = now()
 where challenger_school_id in ('custom-8d925212','custom-e8ab11b6');

-- 2) 영토 이벤트(FK) 해제
delete from public.campus_territory_events
 where from_school_id in ('custom-8d925212','custom-e8ab11b6')
    or to_school_id   in ('custom-8d925212','custom-e8ab11b6');

-- 3) 검증 기여 삭제 (rc2-smoke- 접두사 포함)
delete from public.campus_contributions
 where school_id in ('custom-8d925212','custom-e8ab11b6')
    or session_id like 'rc2-smoke-%' or event_id like 'rc2-smoke-%';

-- 4) 검증 membership 삭제
delete from public.campus_memberships
 where school_id in ('custom-8d925212','custom-e8ab11b6');

-- 5) 검증 학교 삭제 (trigger 가 directory entry 도 함께 지웁니다)
delete from public.campus_schools
 where id in ('custom-8d925212','custom-e8ab11b6') and is_custom = true;

-- 삭제 후 전부 0 확인
select
  (select count(*) from public.campus_contributions
    where school_id in ('custom-8d925212','custom-e8ab11b6')
       or session_id like 'rc2-smoke-%' or event_id like 'rc2-smoke-%') as contributions_after,
  (select count(*) from public.campus_memberships
    where school_id in ('custom-8d925212','custom-e8ab11b6'))           as memberships_after,
  (select count(*) from public.campus_territories
    where owner_school_id  in ('custom-8d925212','custom-e8ab11b6')
       or challenger_school_id in ('custom-8d925212','custom-e8ab11b6')) as territories_after,
  (select count(*) from public.campus_school_directory_entries
    where id in ('custom-8d925212','custom-e8ab11b6'))                  as directory_after;

commit;
