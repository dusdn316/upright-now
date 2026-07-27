/**
 * 출석·streak 날짜는 사용자의 하루 기준인 Asia/Seoul 로 통일합니다.
 * UTC toISOString 날짜는 한국 저녁~자정 사이에 하루가 밀리는 버그가 있어
 * 사용을 금지합니다.
 */
export function kstDateKey(at: number = Date.now()): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 돌려줍니다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/** KST 기준 어제/오늘 비교용 — dateKey 간 일수 차이 */
export function dayDiff(aKey: string, bKey: string): number {
  const a = Date.parse(aKey + 'T00:00:00+09:00')
  const b = Date.parse(bKey + 'T00:00:00+09:00')
  return Math.round((b - a) / 86_400_000)
}
