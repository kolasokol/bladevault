type ApiErrorPayload = {
  error?: string
  message?: string
  details?: {
    message?: string
  }
}

function summarizeResponseText(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return 'The server returned an empty response.'
  }

  const preview = normalized.slice(0, 140)
  return preview === normalized ? preview : `${preview}...`
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (!text) {
    return {} as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    const status = response.status ? ` (HTTP ${response.status})` : ''
    throw new Error(
      `BladeVault received an invalid server response${status}. ${summarizeResponseText(text)}`
    )
  }
}

export function getApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const { error, message, details } = payload as ApiErrorPayload
  return error || message || details?.message || fallback
}
