/** 최소 아이콘 세트 — 외부 서비스 아이콘을 복사하지 않고 직접 그립니다. (docs/18 §9) */
const PATHS: Record<string, string> = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  timer: 'M12 8v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  chart: 'M5 20V10 M12 20V4 M19 20v-7',
  growth: 'M12 21V9 M12 9c0-3 2-5 5-5 0 3-2 5-5 5z M12 13c0-2.5-2-4-4.5-4 0 2.5 2 4 4.5 4z',
  bag: 'M5 8h14l-1 12H6L5 8z M9 8V6a3 3 0 0 1 6 0v2',
  friends: 'M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2 20c0-3 3-5 6-5s6 2 6 5 M17 8a2.5 2.5 0 1 1 0 5 M16 15c3 0 6 2 6 5',
  stretch: 'M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M6 10h12 M12 10v6 M12 16l-3 5 M12 16l3 5',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z',
  shield: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z',
  camera: 'M4 8h3l2-2h6l2 2h3v11H4z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  play: 'M8 5l11 7-11 7z',
  leaf: 'M20 4c0 9-5 14-13 14 0-9 5-14 13-14z M7 18c2-4 5-7 9-9',
  star: 'M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9L9.6 9z',
  check: 'M5 13l4 4 10-10',
  book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M17 20a3 3 0 0 1 3-3V7 M8 8h6 M8 12h6',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3 M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2z M20 15a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
}

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: keyof typeof PATHS | string
  size?: number
  className?: string
}) {
  const d = PATHS[name] ?? PATHS.check
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
