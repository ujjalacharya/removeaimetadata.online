import { describe, expect, it } from 'vitest'
import { assessAiSignals, cleanedFilename, flattenMetadata } from './imageEvidence'

describe('AI signal assessment', () => {
  it('reports strong generator markers', () => {
    const result = assessAiSignals('parameters: prompt\nSteps: 30\nSampler_name: Euler', {})
    expect(result.verdict).toBe('likely-ai')
    expect(result.evidence.some((item) => item.tone === 'strong')).toBe(true)
  })

  it('does not treat absent metadata as proof of human authorship', () => {
    const result = assessAiSignals('', {})
    expect(result.verdict).toBe('inconclusive')
    expect(result.confidence).toBe('low')
  })

  it('treats camera EXIF as a counter-signal without making a guarantee', () => {
    const result = assessAiSignals('', { Make: 'FUJIFILM', Model: 'X-T5' })
    expect(result.verdict).toBe('no-signals')
    expect(result.summary).toContain('not proof')
  })
})

describe('metadata utilities', () => {
  it('keeps readable metadata and skips nested objects', () => {
    expect(flattenMetadata({ Software: 'Example', Nested: { value: 1 } })).toEqual([
      { label: 'Software', value: 'Example' },
    ])
  })

  it('creates a safe clean filename', () => {
    expect(cleanedFilename(new File(['x'], 'holiday photo.jpg', { type: 'image/jpeg' }))).toBe(
      'holiday-photo-clean.jpg',
    )
  })
})
