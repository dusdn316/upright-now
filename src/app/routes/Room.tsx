import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardTitle, Progress } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { ROOM_PRIVACY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useRoomStore } from '@/features/rooms/roomStore'
import {
  joinRoom,
  leaveRoom,
  sendReaction,
  setMyState,
  startRoomSession,
} from '@/features/rooms/roomService'
import { REACTION_LABEL } from '@/features/rooms/roomEvents'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useToast } from '@/app/providers/ToastProvider'
import { Placeholder } from './Placeholder'
import { FRIEND_ROOM } from '@/constants/copy'
import type { CharacterStage } from '@/types'

/** S-08 친구 방 대기실 + 공동 세션 진입 */
export function Room() {
  const navigate = useNavigate()
  const { roomCode = '' } = useParams()
  const { push } = useToast()
  const room = useRoomStore()
  const configureSession = useSessionStore((s) => s.configure)
  const startSession = useSessionStore((s) => s.start)

  // 링크로 직접 들어온 경우 자동 입장 시도
  useEffect(() => {
    if (!featureFlags.friendRoom) return
    if (room.phase === 'idle' && roomCode.length === 6) {
      void joinRoom(roomCode)
    }
  }, [room.phase, roomCode])

  // 세션이 시작되면 개인 세션 화면으로 이동 (각자 기기에서 독립 분석)
  useEffect(() => {
    if (room.phase !== 'running') return
    configureSession({
      subject: room.subject,
      goal: room.goal,
      mode: 'room',
      lengthId:
        room.durationSec === 900 ? '15' : room.durationSec === 3000 ? '50' : '25',
    })
    startSession(`room-${room.code}`)
    void setMyState('focusing')
    navigate(ROUTES.session(`room-${room.code}`))
  }, [room.phase, room.code, room.subject, room.goal, room.durationSec, configureSession, startSession, navigate])

  if (!featureFlags.friendRoom) {
    return (
      <Placeholder
        title="친구 방 대기실"
        description="6자리 코드로 최대 2명이 함께 25분을 진행하는 공간이에요."
        notice={FRIEND_ROOM.toast}
      />
    )
  }

  const me = room.members.find((m) => m.participantId === room.myId)
  const bothReady =
    room.members.length === 2 && room.members.every((m) => m.state === 'ready')

  const copyInvite = async () => {
    const url = `${window.location.origin}/room/${room.code}`
    try {
      await navigator.clipboard.writeText(url)
      push({ title: '초대 링크를 복사했어요.', tone: 'success' })
    } catch {
      push({ title: url, tone: 'info' })
    }
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title={room.roomName || '친구 방'}
        description={ROOM_PRIVACY}
        action={
          room.connection !== 'connected' ? (
            <Badge tone="coral">
              {room.connection === 'reconnecting' ? '다시 연결 중…' : '오프라인'}
            </Badge>
          ) : undefined
        }
      />

      {room.phase === 'connecting' && (
        <Card>
          <p className="text-sm text-ink-soft">방에 연결하는 중이에요…</p>
        </Card>
      )}

      {room.phase === 'error' && (
        <Card tone="yellow">
          <p className="text-sm font-bold text-ink">{room.errorMessage}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void joinRoom(roomCode)}>
              다시 시도
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void leaveRoom()
                navigate(ROUTES.roomNew)
              }}
            >
              방 목록으로
            </Button>
          </div>
        </Card>
      )}

      {(room.phase === 'waiting' || room.phase === 'running') && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card tone="blue">
            <div className="flex items-center justify-between">
              <CardTitle>참가자</CardTitle>
              <Badge tone="blue">{`${room.members.length} / 2`}</Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[0, 1].map((slot) => {
                const member = room.members[slot]
                if (!member) {
                  return (
                    <div
                      key={slot}
                      className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/60 text-sm text-ink-soft"
                    >
                      <Icon name="friends" />
                      친구를 기다리는 중…
                    </div>
                  )
                }
                return (
                  <div
                    key={member.participantId}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-3"
                  >
                    <CharacterViewport
                      stage={Math.min(6, Math.max(1, member.stage)) as CharacterStage}
                      size={80}
                      decorative
                    />
                    <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                      {member.nickname}
                      {member.isHost && <Badge tone="yellow">방장</Badge>}
                    </p>
                    <Badge tone={member.state === 'ready' ? 'green' : 'muted'}>
                      {member.state === 'ready'
                        ? '준비 완료'
                        : member.state === 'focusing'
                          ? '집중 중'
                          : '준비 중'}
                    </Badge>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={me?.state === 'ready' ? 'secondary' : 'primary'}
                onClick={() =>
                  void setMyState(me?.state === 'ready' ? 'joining' : 'ready')
                }
              >
                {me?.state === 'ready' ? '준비 해제' : '준비 완료'}
              </Button>
              {room.isHost && (
                <Button
                  size="sm"
                  disabled={!bothReady}
                  onClick={() => void startRoomSession()}
                >
                  {bothReady ? '세션 시작' : '두 명 모두 준비되면 시작'}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void leaveRoom()
                  navigate(ROUTES.home)
                }}
              >
                나가기
              </Button>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardTitle>초대</CardTitle>
              <p className="mt-2 text-center">
                <span className="tabular rounded-xl bg-canvas px-4 py-2 text-2xl font-bold tracking-[0.3em] text-ink">
                  {room.code}
                </span>
              </p>
              <Button size="sm" fullWidth variant="secondary" className="mt-3" onClick={copyInvite}>
                초대 링크 복사
              </Button>
            </Card>

            <Card>
              <CardTitle>공동 마감괴수</CardTitle>
              <div className="mt-3">
                <Progress
                  value={room.bossHp / room.bossMaxHp}
                  tone="pink"
                  label="공동 보스 체력"
                  thick
                />
                <p className="mt-1 tabular text-xs text-ink-soft">
                  {`${room.bossHp} / ${room.bossMaxHp} · 방어막 ${room.shield}`}
                </p>
              </div>
            </Card>

            <Card>
              <CardTitle>응원 보내기</CardTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['cheer', 'reset', 'done'] as const).map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant="secondary"
                    onClick={() => void sendReaction(kind)}
                  >
                    {REACTION_LABEL[kind]}
                  </Button>
                ))}
              </div>
              {room.reactions[0] && (
                <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs text-ink">
                  {`${room.reactions[0].nickname}: ${REACTION_LABEL[room.reactions[0].reaction]}`}
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  )
}
