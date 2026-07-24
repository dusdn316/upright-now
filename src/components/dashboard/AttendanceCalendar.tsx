import { Card } from '@/components/ui'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 출석 캘린더 — 노랑 카드, 선택 날짜 노랑 원 (docs/12 §11) */
export function AttendanceCalendar({
  attendance,
  today = new Date(),
}: {
  attendance: string[]
  today?: Date
}) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const dayCount = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ]

  return (
    <Card tone="yellow" className="p-4">
      <p className="mb-3 text-center text-sm font-bold text-ink">
        {`${year}년 ${month + 1}월`}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {WEEKDAYS.map((day) => (
          <span key={day} className="font-semibold text-ink-soft">
            {day}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = day === today.getDate()
          const attended = attendance.includes(key)
          return (
            <span
              key={key}
              aria-label={attended ? `${day}일 출석` : `${day}일`}
              className={[
                'mx-auto flex h-6 w-6 items-center justify-center rounded-full tabular',
                isToday ? 'bg-yellow font-bold text-ink' : 'text-ink-soft',
                attended && !isToday ? 'bg-surface font-bold text-ink' : '',
              ].join(' ')}
            >
              {day}
            </span>
          )
        })}
      </div>
    </Card>
  )
}
