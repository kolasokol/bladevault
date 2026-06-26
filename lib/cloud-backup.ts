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

export type SignedCloudImageUpload = {
  knifeId: string;
  key: string;
  method: 'PUT';
  uploadUrl: string;
  publicUrl: string;
  headers?: Record<string, string>;
  expiresAt: string;
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

function getContentTypeFromFilename(filename: string): string {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.avif')) return 'image/avif';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',', 2);
  if (parts.length !== 2) {
    throw new Error('Invalid image data URL');
  }

  const header = parts[0];
  const base64 = parts[1];
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) {
    throw new Error('Invalid image data URL');
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeMatch[1] });
}

export async function uploadCloudBackupImage(params: {
  baseUrl: string;
  file: Blob;
  filename: string;
  knifeId: string;
}): Promise<{ knifeId: string; publicUrl: string }> {
  const { baseUrl, file, filename, knifeId } = params;
  const contentType = file.type || getContentTypeFromFilename(filename);

  const signResponse = await fetch(`${baseUrl}/api/v1/images/sign-upload`, {
    method: 'POST',
    credentials: 'include',
    headers: createCloudBackupHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      knifeId,
      filename,
      contentType,
    }),
  });

  if (!signResponse.ok) {
    throw new Error(await parseApiError(signResponse));
  }

  const signedUpload = (await signResponse.json()) as Partial<SignedCloudImageUpload>;
  if (!signedUpload.uploadUrl || !signedUpload.publicUrl || !signedUpload.method) {
    throw new Error('Signed upload response was incomplete.');
  }

  const uploadResponse = await fetch(signedUpload.uploadUrl, {
    method: signedUpload.method,
    headers: signedUpload.headers,
    body: file,
  });

  if (!uploadResponse.ok) {
    const details = await uploadResponse.text().catch(() => '');
    throw new Error(details || `Direct image upload failed (${uploadResponse.status})`);
  }

  return {
    knifeId: signedUpload.knifeId || knifeId,
    publicUrl: signedUpload.publicUrl,
  };
}
