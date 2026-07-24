import type { ReactNode } from 'react'
import { SidebarNavigation } from './SidebarNavigation'

/**
 * 화면 골격.
 * - full: 사이드바 + 중앙 + 오른쪽 레일 (docs/12 §7)
 * - focus: 세션 중. 사이드바를 숨기고 단순하게 (docs/04 §3)
 */
export function AppShell({
  children,
  rail,
  chrome = 'full',
}: {
  children: ReactNode
  rail?: ReactNode
  chrome?: 'full' | 'focus'
}) {
  if (chrome === 'focus') {
    return (
      <div className="min-h-dvh bg-canvas">
        <main className="mx-auto w-full max-w-[1100px] px-6 py-8">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      <SidebarNavigation />
      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-6 py-7 xl:px-8">
        {/*
          @container: 카드 내부 배치를 뷰포트가 아니라 "본문 실제 폭" 기준으로
          바꿉니다. 1280 처럼 오른쪽 레일이 함께 보이는 폭에서 카드가 넘치지 않습니다.
        */}
        <main className="@container min-w-0 flex-1">{children}</main>
        {rail && (
          <div className="hidden w-[300px] shrink-0 flex-col gap-4 xl:flex">
            {rail}
          </div>
        )}
      </div>
    </div>
  )
}

/** 화면 상단 제목 블록 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[15px] text-ink-soft">{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}
