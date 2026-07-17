import { isIP } from 'net'

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^\s*$/,
]

function isPrivateIp(host: string): boolean {
  const ipVersion = isIP(host)
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number)
    const [a, b, c] = parts
    // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12,
    // 192.168.0.0/16, 192.0.0.0/24, 192.0.2.0/24, 198.18.0.0/15,
    // 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 192 && b === 0 && c === 0) return true
    if (a === 192 && b === 0 && c === 2) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    if (a === 198 && b === 51 && c === 100) return true
    if (a === 203 && b === 0 && c === 113) return true
    if (a >= 224 && a <= 239) return true
    if (a >= 240 && a <= 255) return true
    return false
  }

  if (ipVersion === 6) {
    const normalized = host.toLowerCase()
    // Loopback ::1/128
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
    // Link-local fe80::/10
    if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true
    // Unique local fc00::/7
    if (/^fc[0-9a-f][0-9a-f]:/i.test(normalized) || /^fd[0-9a-f][0-9a-f]:/i.test(normalized)) return true
    return false
  }

  return false
}

function isBlockedHost(host: string): boolean {
  const withoutPort = host.split(':')[0]
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(withoutPort))) {
    return true
  }
  return isPrivateIp(withoutPort)
}

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string }

export function validateExternalUrl(
  value: string,
  options?: { allowDataUrl?: boolean },
): UrlValidationResult {
  if (!value) {
    return { ok: false, reason: 'URL is empty' }
  }

  if (options?.allowDataUrl && value.startsWith('data:')) {
    return { ok: true, url: new URL(value) }
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTP and HTTPS URLs are allowed' }
  }

  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, reason: 'Private or internal URLs are not allowed' }
  }

  return { ok: true, url: parsed }
}
