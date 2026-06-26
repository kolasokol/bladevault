export const DEFAULT_CLOUD_BACKUP_URL =
  process.env.NEXT_PUBLIC_BLADEVAULT_BACKEND_URL?.trim() || 'https://api-staging.tkweb.site';

const CLOUD_BACKUP_TOKEN_KEY = 'bladevault.cloudBackupToken';

export type CloudBackupSession = {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified?: boolean;
  };
  session: {
    id: string;
    expiresAt: string;
  };
};

export function normalizeCloudBackupUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function getCloudBackupUrl(url?: string | null): string {
  return normalizeCloudBackupUrl(url || DEFAULT_CLOUD_BACKUP_URL);
}

export function getCloudBackupAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CLOUD_BACKUP_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setCloudBackupAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLOUD_BACKUP_TOKEN_KEY, token);
  } catch {
    // ignore storage failures
  }
}

export function clearCloudBackupAuthToken() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CLOUD_BACKUP_TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
}

export function createCloudBackupHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getCloudBackupAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string;
      message?: string;
      details?: { message?: string };
    };
    return data.error || data.message || data.details?.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
