import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { Button, Card, TextField } from '@/components/ui'
import { DEFAULT_NICKNAME } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { useUserStore } from '@/features/onboarding/userStore'

/** S-02 닉네임 — docs/05, docs/13 §3 */
export function OnboardingName() {
  const navigate = useNavigate()
  const setNickname = useUserStore((s) => s.setNickname)
  const [value, setValue] = useState('')

  return (
    <AppShell chrome="focus">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-10">
        <CharacterViewport stage={1} size={160} />

        <Card className="w-full">
          <h1 className="text-2xl font-bold text-ink">어떻게 불러드릴까요?</h1>
          <p className="mt-2 text-sm text-ink-soft">
            친구 방과 결과 화면에서 사용할 별명이에요. 실명 대신 편한 이름을
            사용해도 좋아요.
          </p>

          <div className="mt-6">
            <TextField
              label="닉네임"
              id="nickname"
              maxLength={12}
              placeholder="닉네임을 입력해 주세요"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              hint={`최대 12자 · 입력하지 않으면 '${DEFAULT_NICKNAME}'으로 시작해요`}
            />
          </div>

          <Button
            size="lg"
            fullWidth
            className="mt-6"
            onClick={() => {
              setNickname(value)
              navigate(ROUTES.profiles)
            }}
          >
            이 이름으로 시작하기
          </Button>

          <p className="mt-3 text-center text-xs text-ink-soft">
            닉네임은 현재 브라우저에만 저장돼요.
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
