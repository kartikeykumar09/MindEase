import { describe, it, expect } from 'vitest'
import { TELE_MANAS, DISCLAIMER, OLLAMA_URL } from './constants.js'

describe('safety constants', () => {
  it('hardcodes the Tele-MANAS helpline — never model-generated', () => {
    expect(TELE_MANAS.primary).toBe('14416')
    expect(TELE_MANAS.alternate).toBe('1-800-891-4416')
  })

  it('surfaces the helpline in the always-visible disclaimer', () => {
    expect(DISCLAIMER).toContain('14416')
    expect(DISCLAIMER).toContain('not a substitute for professional care')
  })

  it('points the on-device model at localhost only (data never leaves the device)', () => {
    expect(OLLAMA_URL.startsWith('http://localhost')).toBe(true)
  })
})
