import { describe, expect, it } from 'vitest'
import { ISLAND_SHAPES } from './islandMap'
import manifest from './territorySeedManifest.json'
import campusSql from '../../../supabase/migrations/20260727_campus_realtime_v2.sql?raw'
import roomSql from '../../../supabase/migrations/20260727_room_presence_cleanup.sql?raw'
import repoSrc from './supabaseRepository.ts?raw'

/**
 * SQL 마이그레이션 ↔ 클라이언트 단일 기준 검증.
 * 36 territory 좌표·zone·이름이 한 글자도 다르지 않아야 하고,
 * v1 사각 타일 명칭이 코드·SQL 어디에도 남지 않아야 합니다.
 */

describe('campus v2 — 36 territory id 일치', () => {
  it('seed manifest 는 islandMap SPOTS 와 정확히 같다', () => {
    expect(manifest).toHaveLength(36)
    expect(manifest).toEqual(
      ISLAND_SHAPES.map(({ x, y, zone, name }) => ({ x, y, zone, name })),
    )
  })

  it('SQL seed 에 36 territory 가 전부 같은 값으로 들어 있다', () => {
    for (const s of ISLAND_SHAPES) {
      expect(campusSql).toContain(`(${s.x}, ${s.y}, '${s.zone}', '${s.name}')`)
    }
    // territory id 규칙이 클라이언트 tileId 와 동일한 형태인지
    expect(campusSql).toContain(`v_season || ':' || r.x || '-' || r.y`)
  })

  it('활성 시즌 seed 가 존재하고 클라이언트 season 규칙과 같다', () => {
    expect(campusSql).toContain(`'season-' || (v_index + 1)`)
    expect(campusSql).toContain(`timestamptz '2026-01-05 00:00:00+00'`)
    expect(campusSql).toContain(`interval '14 days'`)
    expect(campusSql).toContain(`insert into public.campus_seasons`)
  })
})

describe('campus v2 — 스키마/저장소 명칭 일치', () => {
  const canonical = [
    'campus_schools',
    'campus_memberships',
    'campus_seasons',
    'campus_territories',
    'campus_contributions',
    'campus_territory_events',
    'upsert_custom_school',
    'select_campus_school',
    'apply_campus_contribution',
    'campus_season_standings',
  ]

  it('SQL 에 최종 기준 명칭이 모두 있다', () => {
    for (const name of canonical) expect(campusSql).toContain(name)
  })

  it('저장소가 v2 명칭만 사용한다 (v1 잔재 0)', () => {
    for (const name of [
      'campus_territories',
      'campus_territory_events',
      'apply_campus_contribution',
      'campus_season_standings',
      'campus_my_contribution',
      'select_campus_school',
    ]) {
      expect(repoSrc).toContain(name)
    }
    for (const legacy of [
      'campus_tiles',
      'campus_tile_events',
      'campus_record_contribution',
    ]) {
      expect(repoSrc).not.toContain(legacy)
      expect(campusSql).not.toContain(legacy)
    }
  })

  it('Realtime 구독 테이블 이름이 SQL publication 과 같다', () => {
    expect(repoSrc).toContain(`table: 'campus_territories'`)
    expect(repoSrc).toContain(`table: 'campus_territory_events'`)
    expect(campusSql).toContain(
      'alter publication supabase_realtime add table public.campus_territories',
    )
    expect(campusSql).toContain(
      'alter publication supabase_realtime add table public.campus_territory_events',
    )
  })
})

describe('campus v2 — 소속 위조 차단 (서버 결정)', () => {
  it('apply_campus_contribution 은 school/member 를 클라이언트에서 받지 않는다', () => {
    const signature = campusSql.slice(
      campusSql.indexOf('create or replace function public.apply_campus_contribution'),
      campusSql.indexOf('$fn$', campusSql.indexOf('apply_campus_contribution')),
    )
    expect(signature).not.toContain('p_school_id')
    expect(signature).not.toContain('p_member_hash')
    expect(campusSql).toContain(
      'select school_id into v_school',
    )
    expect(campusSql).toContain(`md5(auth.uid()::text || ':' || v_season)`)
  })

  it('클라이언트도 school/member 인자를 보내지 않는다', () => {
    const call = repoSrc.slice(
      repoSrc.indexOf("rpc('apply_campus_contribution'"),
      repoSrc.indexOf('})', repoSrc.indexOf("rpc('apply_campus_contribution'")),
    )
    expect(call).not.toContain('p_school_id')
    expect(call).not.toContain('p_member_hash')
  })

  it('membership 변경 제한과 커스텀 학교 소유권이 서버에 있다', () => {
    expect(campusSql).toContain('changes_in_season >= 1')
    expect(campusSql).toContain('created_by = auth.uid()')
    expect(campusSql).toContain("p_id !~ '^custom-[0-9a-f]{1,8}$'")
  })
})

describe('room presence v2 — 멤버십 가드', () => {
  it('is_room_member 게이트가 정의돼 있다', () => {
    expect(roomSql).toContain('create or replace function public.is_room_member')
  })

  it('세 RPC 모두 비멤버를 거부한다', () => {
    expect(roomSql).toContain("raise exception 'not a room member'")
    // heartbeat: 내 행 0개면 오류
    expect(roomSql).toContain('get diagnostics v_updated = row_count')
    // cleanup·complete: is_room_member 검사
    const guards = roomSql.match(/if not public\.is_room_member\(p_room_id\) then/g)
    expect(guards?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('cleanup 은 자신을 지우지 않고, 동시 실행은 행 잠금으로 직렬화한다', () => {
    expect(roomSql).toContain('user_id <> auth.uid()')
    expect(roomSql).toContain('for update')
  })

  it('완료 처리는 running + 정확히 2명 완주일 때만', () => {
    expect(roomSql).toContain("where id = p_room_id and status = 'running'")
    expect(roomSql).toContain('v_total = 2 and v_done = 2')
  })
})
