// Bangladeshi mobile format: 01[3-9]XXXXXXXX (11 digits), optionally
// prefixed with the country code (+880 or 880) instead of the leading 0.
const BD_PHONE_RE = /^(?:\+?880|0)1[3-9]\d{8}$/

export function isValidBangladeshiPhone(phone) {
  const cleaned = phone.replace(/[\s-]/g, '')
  return BD_PHONE_RE.test(cleaned)
}

export function isValidClientName(name) {
  const trimmed = name.trim()
  if (trimmed.length < 2) return false
  if (/^\d+$/.test(trimmed)) return false // all digits
  if (!/[a-zA-Zঀ-৿]/.test(trimmed)) return false // must contain a letter (Latin or Bengali)
  if (/^(.)\1+$/.test(trimmed.replace(/\s/g, ''))) return false // repeated single character
  return true
}
