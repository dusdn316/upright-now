import { useNavigate } from 'react-router-dom'
import { CHARACTER_STAGES } from '@/constants/game'
import { ROUTES } from '@/constants/routes'
import { POSTURE_COPY } from '@/constants/copy'
import { Badge, Button, Card, CardTitle } from '@/components/ui'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useGameStore } from '@/features/game/gameStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useToast } from '@/app/providers/ToastProvider'
import { useQaFlagsStore } from './qaFlagsStore'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import type { PostureState } from '@/types'

const STATES: PostureState[] = ['good', 'warning', 'bad', 'away', 'unstable']

/**
 * QA Lab 상태 주입 패널 — docs/02 FR-017, docs/05 S-17
 *
 * 카메라가 없어도 핵심 흐름을 검증할 수 있어야 합니다. (AGENTS.md §6)
 * /lab 화면과 집중 세션 화면에서 같은 컴포넌트를 씁니다.
 */
export function QaLabPanel({ compact = false }: { compact?: boolean }) {
  const snapshot = usePostureStore((s) => s.snapshot)
  const setPostureState = usePostureStore((s) => s.setPostureState)
  const emitEvent = usePostureStore((s) => s.emitEvent)
  const setIntent = useCharacterVisualStore((s) => s.setIntent)
  const navigate = useNavigate()
  const imagesBroken = useQaFlagsStore((s) => s.characterImagesBroken)
  const setImagesBroken = useQaFlagsStore((s) => s.setCharacterImagesBroken)
  const timeScale = useSessionStore((s) => s.timeScale)
  const setTimeScale = useSessionStore((s) => s.setTimeScale)
  const { push } = useToast()

  return (
    <Card tone="canvas" className={compact ? 'p-4' : ''}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <CardTitle>QA Lab · 상태 주입</CardTitle>
        <Badge tone="blue">개발용</Badge>
      </div>

      <p className="mb-4 text-xs text-ink-soft">
        카메라 없이 자세 상태를 주입합니다. 아래 버튼은 캐릭터·피드백·회복
        콤보·몬스터 체력·XP에 그대로 반영됩니다. 같은 조작을 콘솔의{' '}
        <code>window.__upright</code> 로도 할 수 있습니다.
      </p>

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold text-ink-soft">자세 상태</legend>
        <div className="flex flex-wrap gap-2">
          {STATES.map((state) => (
            <Button
              key={state}
              size="sm"
              variant={snapshot.state === state ? 'primary' : 'secondary'}
              onClick={() => {
                // 자세 상태를 직접 고르면 게임 표현(recover 등)은 해제합니다.
                setIntent(null)
                setPostureState(state)
              }}
            >
              {`${state} · ${POSTURE_COPY[state].label}`}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold text-ink-soft">회복 이벤트</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPostureState('bad')
              emitEvent('recovery_started')
            }}
          >
            회복 기회 시작
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPostureState('good')
              setIntent('recover')
            }}
          >
            회복 중 (recover)
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setPostureState('good')
              emitEvent('recovery_succeeded')
            }}
          >
            recovery success
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => emitEvent('recovery_missed')}
          >
            회복 기회 놓침
          </Button>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold text-ink-soft">세션</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              useGameStore.getState().reset()
              useSessionStore.getState().start('demo')
            }}
          >
            세션 시작
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => useSessionStore.getState().completeNow()}
          >
            세션 완료 처리
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.session())}>
            세션 화면 열기
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.result())}>
            결과 화면 열기
          </Button>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold text-ink-soft">타이머 가속</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 10, 60].map((scale) => (
            <Button
              key={scale}
              size="sm"
              variant={timeScale === scale ? 'primary' : 'secondary'}
              onClick={() => setTimeScale(scale)}
            >
              {`${scale}배속`}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold text-ink-soft">성장 단계 변경</legend>
        <div className="flex flex-wrap gap-2">
          {CHARACTER_STAGES.map((meta) => (
            <Button
              key={meta.stage}
              size="sm"
              variant="secondary"
              onClick={() =>
                useProgressionStore.setState({ xp: meta.requiredXp })
              }
            >
              {`Lv.${meta.stage}`}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-bold text-ink-soft">기타</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => useProgressionStore.getState().addPoints(100)}
          >
            포인트 +100
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => useGameStore.getState().reset()}
          >
            보스·콤보 초기화
          </Button>
          <Button
            size="sm"
            variant={imagesBroken ? 'primary' : 'secondary'}
            onClick={() => setImagesBroken(!imagesBroken)}
          >
            {imagesBroken ? '캐릭터 이미지 복구' : '캐릭터 이미지 실패'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              push({
                title: '자세 감지 도구를 준비하지 못했어요.',
                description: '다시 시도하거나 데모 모드로 확인할 수 있어요.',
                tone: 'warning',
              })
            }
          >
            모델 실패
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              push({
                title: '이번 결과를 기기에 저장하지 못했어요.',
                description: '화면의 결과는 유지되니 다시 저장해 주세요.',
                tone: 'warning',
              })
            }
          >
            저장 실패
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              push({
                title: '이 브라우저에서는 별도 작은 창을 지원하지 않아요.',
                description: '화면 오른쪽 아래 미니 캐릭터로 대신 보여드릴게요.',
                tone: 'info',
              })
            }
          >
            PIP 미지원
          </Button>
        </div>
      </fieldset>
    </Card>
  )
}
