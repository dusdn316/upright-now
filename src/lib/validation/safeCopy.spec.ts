import { describe, expect, it } from 'vitest'
import { collectStrings, findRiskyPhrases } from './safeCopy'
import * as copy from '@/constants/copy'
import { CHARACTER_STAGES } from '@/constants/game'
import { LEARNING_PROFILES } from '@/constants/profiles'
import { STRETCH_ROUTINES } from '@/constants/stretch'

describe('findRiskyPhrases — 확정적인 의료 표현만 잡는다', () => {
  it.each([
    '거북목으로 진단됐어요',
    '지금 자세는 정상 자세가 아닙니다',
    '오늘의 목 건강 점수는 72점',
    '이 기능은 통증을 예방합니다',
    '거북목 확률 82%',
    '치료가 필요합니다',
  ])('금지: %s', (text) => {
    expect(findRiskyPhrases(text).length).toBeGreaterThan(0)
  })

  it.each([
    '이 서비스는 거북목을 진단하지 않습니다',
    '의료 진단이나 치료를 대신하지 않아요',
    '자세 점수 대신 회복 성공을 보여드려요',
    'CVA 같은 임상 지표는 사용하지 않아요',
    '처음 등록한 기준에서 조금 벗어났어요',
  ])('허용: %s', (text) => {
    expect(findRiskyPhrases(text)).toEqual([])
  })
})

describe('제품 문구 상수 검사', () => {
  const texts = [
    ...collectStrings(copy),
    ...collectStrings(CHARACTER_STAGES),
    ...collectStrings(LEARNING_PROFILES),
    ...collectStrings(STRETCH_ROUTINES),
  ]

  it('사용자에게 보이는 문구에 확정적 의료 표현이 없다', () => {
    const flagged = texts
      .map((text) => ({ text, risky: findRiskyPhrases(text) }))
      .filter((entry) => entry.risky.length > 0)

    expect(flagged).toEqual([])
  })

  it('비진단 안전 문구는 그대로 유지한다', () => {
    expect(copy.PRIVACY.medical).toContain('의료 진단이나 치료를 제공하지 않아요')
  })
})
