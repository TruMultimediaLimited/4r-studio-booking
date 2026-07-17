import { describe, it, expect } from 'vitest'
import { isValidBangladeshiPhone, isValidClientName } from './validation.js'

describe('isValidBangladeshiPhone', () => {
  it('accepts standard 11-digit mobile numbers', () => {
    expect(isValidBangladeshiPhone('01712345678')).toBe(true)
    expect(isValidBangladeshiPhone('01912345678')).toBe(true)
    expect(isValidBangladeshiPhone('01312345678')).toBe(true)
  })

  it('accepts the country-code form with or without +', () => {
    expect(isValidBangladeshiPhone('+8801712345678')).toBe(true)
    expect(isValidBangladeshiPhone('8801712345678')).toBe(true)
  })

  it('ignores spaces and hyphens', () => {
    expect(isValidBangladeshiPhone('017 1234 5678')).toBe(true)
    expect(isValidBangladeshiPhone('017-1234-5678')).toBe(true)
  })

  it('rejects invalid operator prefixes, lengths and garbage', () => {
    expect(isValidBangladeshiPhone('01112345678')).toBe(false) // 011 is not a valid prefix
    expect(isValidBangladeshiPhone('0171234567')).toBe(false) // too short
    expect(isValidBangladeshiPhone('017123456789')).toBe(false) // too long
    expect(isValidBangladeshiPhone('abcdefghijk')).toBe(false)
    expect(isValidBangladeshiPhone('')).toBe(false)
  })
})

describe('isValidClientName', () => {
  it('accepts normal Latin and Bengali names', () => {
    expect(isValidClientName('Rahim Uddin')).toBe(true)
    expect(isValidClientName('রহিম')).toBe(true)
  })

  it('rejects too-short, all-digit and letterless input', () => {
    expect(isValidClientName('a')).toBe(false)
    expect(isValidClientName('12345')).toBe(false)
    expect(isValidClientName('!!!')).toBe(false)
  })

  it('rejects a single repeated character', () => {
    expect(isValidClientName('aaaaaa')).toBe(false)
    expect(isValidClientName('a a a a')).toBe(false)
  })
})
