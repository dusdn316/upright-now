import { Badge, Card, CardTitle } from '@/components/ui'
import { usePostureDebugStore } from '@/features/posture-engine/postureDebugStore'
import type { PointName } from '@/features/posture-engine/features'

/**
 * Posture Debug 계기판 — QA Lab 전용.
 * 실제 카메라 분류기가 프레임마다 채우는 값을 그대로 보여줍니다.
 */
const POINT_LABELS: Record<PointName, string> = {
  nose: 'nose',
  leftEyeOuter: 'eye L(outer)',
  rightEyeOuter: 'eye R(outer)',
  leftEar: 'ear L',
  rightEar: 'ear R',
  leftShoulder: 'shoulder L',
  rightShoulder: 'shoulder R',
  leftHip: 'hip L',
  rightHip: 'hip R',
}

function fmt(n: number | null | undefined, digits = 3): string {
  return n === null || n === undefined ? '—' : n.toFixed(digits)
}

export function PostureDebugPanel() {
  const d = usePostureDebugStore()

  return (
    <Card tone="canvas">
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardTitle>Posture Debug</CardTitle>
        <Badge tone={d.live ? 'green' : 'muted'}>
          {d.live ? '카메라 연동 중' : '카메라 미사용'}
        </Badge>
      </div>

      {!d.live ? (
        <p className="text-xs text-ink-soft">
          카메라 세션 또는 캘리브레이션을 시작하면 실시간 값이 표시됩니다. QA
          상태 주입은 이 계기판을 거치지 않습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-4 text-xs">
          {/* 상태 요약 */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={d.quality === 'good' ? 'green' : d.quality === 'limited' ? 'yellow' : 'coral'}>
              {`quality: ${d.quality}`}
            </Badge>
            <Badge tone="blue">{`instant: ${d.instant}`}</Badge>
            <Badge tone="muted">{`arbiter: ${d.arbiter}`}</Badge>
            {d.multiPerson && <Badge tone="coral">두 명 이상</Badge>}
            {d.distanceMismatch && <Badge tone="coral">카메라 거리 확인</Badge>}
          </div>
          {d.qualityReason && (
            <p className="text-ink-soft">{`이유: ${d.qualityReason}`}</p>
          )}

          {/* 랜드마크 */}
          <div>
            <p className="mb-1 font-bold text-ink">랜드마크 visibility</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 tabular">
              {d.points &&
                (Object.keys(POINT_LABELS) as PointName[]).map((name) => {
                  const p = d.points?.[name]
                  return (
                    <span
                      key={name}
                      className={p?.present ? 'text-ink' : 'text-muted line-through'}
                    >
                      {`${POINT_LABELS[name]} ${fmt(p?.visibility, 2)}`}
                    </span>
                  )
                })}
            </div>
            <p className="mt-1 tabular text-ink-soft">
              {`shoulderWidth ${fmt(d.shoulderWidth)} (기준 ${fmt(d.baselineShoulderWidth)}) · yaw ${fmt(d.yawRatio, 2)}`}
            </p>
          </div>

          {/* 특징 편차 */}
          <div>
            <p className="mb-1 font-bold text-ink">특징 편차 (tolerance 단위)</p>
            <table className="w-full text-left tabular">
              <thead>
                <tr className="text-ink-soft">
                  <th className="pr-2 font-normal">feature</th>
                  <th className="pr-2 font-normal">value</th>
                  <th className="pr-2 font-normal">base</th>
                  <th className="pr-2 font-normal">tol</th>
                  <th className="font-normal">dev</th>
                </tr>
              </thead>
              <tbody>
                {d.details.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.exceeded
                        ? 'font-bold text-[#b8285a]'
                        : row.deviation >= 0.65
                          ? 'text-[#8a6b12]'
                          : 'text-ink'
                    }
                  >
                    <td className="pr-2">
                      {row.key}
                      {!row.primary && ' (보조)'}
                    </td>
                    <td className="pr-2">{fmt(row.value)}</td>
                    <td className="pr-2">{fmt(row.baseline)}</td>
                    <td className="pr-2">{fmt(row.tolerance)}</td>
                    <td>{fmt(row.deviation, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.keys(d.excluded).length > 0 && (
              <p className="mt-1 text-ink-soft">
                {`제외: ${Object.entries(d.excluded)
                  .map(([k, v]) => `${k}(${v})`)
                  .join(' · ')}`}
              </p>
            )}
          </div>

          {/* 투표 */}
          <div>
            <p className="mb-1 font-bold text-ink">판정 투표</p>
            <p className="text-ink-soft">
              {`warning ${d.voteWarning ? 'O' : 'X'} · bad ${d.voteBad ? 'O' : 'X'}`}
              {d.voters.length > 0 && ` · 투표한 특징: ${d.voters.join(', ')}`}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
