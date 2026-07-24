/**
 * 위험한 "확정 표현" 검사기 — AGENTS.md §2.4, docs/14 §4
 *
 * 단어 하나로 실패시키지 않습니다.
 * `점수`, `CVA`, `진단`, `거북목` 은 안전 안내나 비교 설명에 쓰일 수 있으므로
 * 단독 사용을 막지 않고, 아래처럼 의료적으로 확정하는 표현만 잡습니다.
 *
 * 예) "이 서비스는 거북목을 진단하지 않습니다" → 허용
 *     "거북목으로 진단됐어요"                  → 금지
 */
export const RISKY_PHRASES: string[] = [
  '거북목으로 진단됐어요',
  '거북목으로 진단되었습니다',
  '정상 자세가 아닙니다',
  '목 건강 점수',
  '통증을 예방합니다',
  '거북목 확률',
  '치료가 필요합니다',
  '평균 자세 점수',
  'CVA 점수',
]

/** 텍스트에서 발견된 위험 표현 목록을 돌려줍니다. 없으면 빈 배열입니다. */
export function findRiskyPhrases(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ')
  return RISKY_PHRASES.filter((phrase) => normalized.includes(phrase))
}

/** 객체 안의 모든 문자열을 평평하게 모읍니다. (문구 상수 검사용) */
export function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    acc.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, acc)
  }
  return acc
}
