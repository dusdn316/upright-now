import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button, Card, CardTitle, SegmentedControl, TextField } from '@/components/ui'
import { ROOM_PRIVACY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { createRoom, joinRoom } from '@/features/rooms/roomService'
import { useRoomStore } from '@/features/rooms/roomStore'
import { Placeholder } from './Placeholder'
import { FRIEND_ROOM } from '@/constants/copy'

const DURATIONS = [
  { id: '1500', label: '25분', sublabel: '기본' },
  { id: '900', label: '15분', sublabel: '짧게' },
  { id: '3000', label: '50분', sublabel: '길게' },
]

/** S-07 친구 방 생성·입장 — 최대 2명, 카메라·자세 상태는 공유하지 않습니다 */
export function RoomNew() {
  const navigate = useNavigate()
  const errorMessage = useRoomStore((s) => s.errorMessage)
  const phase = useRoomStore((s) => s.phase)

  const [roomName, setRoomName] = useState('')
  const [subject, setSubject] = useState('')
  const [goal, setGoal] = useState('')
  const [durationId, setDurationId] = useState('1500')
  const [joinCode, setJoinCode] = useState('')

  if (!featureFlags.friendRoom) {
    return (
      <Placeholder
        title="친구 방 만들기"
        description="친구에게는 닉네임, 진행 상태, 게임 이벤트만 보여요. 카메라와 개인 자세 상태는 공유하지 않아요."
        notice={FRIEND_ROOM.toast}
      />
    )
  }

  const busy = phase === 'connecting'

  const submitCreate = async () => {
    const result = await createRoom({
      roomName,
      subject,
      goal,
      durationSec: Number(durationId),
    })
    if (result.ok && result.code) navigate(ROUTES.room(result.code))
  }

  const submitJoin = async () => {
    if (joinCode.trim().length < 6) return
    const result = await joinRoom(joinCode.trim())
    if (result.ok) navigate(ROUTES.room(joinCode.trim().toUpperCase()))
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="친구와 함께 25분을 시작해 볼까요?"
        description={ROOM_PRIVACY}
        back={ROUTES.home}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>방 만들기</CardTitle>
          <div className="mt-4 flex flex-col gap-3">
            <TextField
              label="방 이름"
              id="room-name"
              placeholder="예: 시험주간 스터디"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <TextField
              label="과목 또는 과제"
              id="room-subject"
              placeholder="예: 자료구조"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <TextField
              label="오늘 목표"
              id="room-goal"
              placeholder="예: 3장 문제 풀기"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">세션 길이</p>
              <SegmentedControl
                ariaLabel="세션 길이"
                columns={3}
                value={durationId}
                onChange={setDurationId}
                options={DURATIONS}
              />
            </div>
            <Button fullWidth disabled={busy} onClick={submitCreate}>
              {busy ? '만드는 중…' : '방 만들기'}
            </Button>
          </div>
        </Card>

        <Card tone="blue">
          <CardTitle>코드로 입장</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            친구가 알려준 6자리 코드를 입력해 주세요.
          </p>
          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="방 코드"
                id="room-code"
                maxLength={6}
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </div>
            <Button disabled={busy || joinCode.trim().length < 6} onClick={submitJoin}>
              입장
            </Button>
          </div>
          {errorMessage && (
            <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-[#b8285a]">
              {errorMessage}
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
