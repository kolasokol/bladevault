export const DEFAULT_CLOUD_AUTH_URL = process.env.NEXT_PUBLIC_BLADEVAULT_AUTH_URL?.trim() || '';

export const DEFAULT_CLOUD_BACKUP_URL =
  process.env.NEXT_PUBLIC_BLADEVAULT_BACKUP_URL?.trim() || '';

const CLOUD_AUTH_STATE_KEY = 'bladevault.cloudAuthState';

export type CloudBackupSession = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
  session: {
    id: string;
    expiresAt: string;
    token: string;
  };
};

export type CloudAuthSuccessMessage = {
  type: 'bladevault-auth-success';
  accessToken: string;
  sessionToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
};

export type CloudAuthErrorMessage = {
  type: 'bladevault-auth-error';
  error: {
    message: string;
  };
};

export type CloudAuthState = {
  accessToken: string;
  sessionToken: string;
  expiresAt: string;
  user: CloudBackupSession['user'];
};

export function normalizeCloudUrl(url: string): string {
  let normalized = url.trim();
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/$/, '');
}

export function getCloudAuthUrl(): string {
  return DEFAULT_CLOUD_AUTH_URL ? normalizeCloudUrl(DEFAULT_CLOUD_AUTH_URL) : '';
}

export function getCloudBackupUrl(): string {
  return DEFAULT_CLOUD_BACKUP_URL ? normalizeCloudUrl(DEFAULT_CLOUD_BACKUP_URL) : '';
}

export function getCloudAuthState(): CloudAuthState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CLOUD_AUTH_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CloudAuthState>;
    if (
      !parsed ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.sessionToken !== 'string' ||
      typeof parsed.expiresAt !== 'string' ||
      !parsed.user
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      sessionToken: parsed.sessionToken,
      expiresAt: parsed.expiresAt,
      user: parsed.user,
    };
  } catch {
    return null;
  }
}

export function setCloudAuthState(state: CloudAuthState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLOUD_AUTH_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

export function clearCloudAuthState() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CLOUD_AUTH_STATE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function createCloudAuthHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const state = getCloudAuthState();
  if (state?.sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${state.sessionToken}`);
  }
  return headers;
}

export function createCloudBackupHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const state = getCloudAuthState();
  if (state?.accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${state.accessToken}`);
  }
  return headers;
}

export async function refreshCloudBackupAccessToken(): Promise<string> {
  const state = getCloudAuthState();
  if (!state?.sessionToken) {
    throw new Error('Sign in before requesting a backup token.');
  }

  const authUrl = getCloudAuthUrl();
  if (!authUrl) {
    throw new Error('NEXT_PUBLIC_BLADEVAULT_AUTH_URL is not configured.');
  }

  const response = await fetch(`${authUrl}/api/auth/token`, {
    headers: createCloudAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error('Auth server did not return a backup token.');
  }

  setCloudAuthState({
    ...state,
    accessToken: data.token,
  });

  return data.token;
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
