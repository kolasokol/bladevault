import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getLocalDb } from './local-db';

export type StorageMode = 'local' | 'remote';

export type AppSettings = {
  storageMode: StorageMode;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  d1DatabaseId: string;
  d1DatabaseName: string;
  r2BucketName: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Endpoint: string;
  r2BucketUrl: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  storageMode: 'local',
  cloudflareAccountId: '',
  cloudflareApiToken: '',
  d1DatabaseId: '',
  d1DatabaseName: '',
  r2BucketName: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2Endpoint: '',
  r2BucketUrl: '',
};

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  storageMode: 'storage_mode',
  cloudflareAccountId: 'cloudflare_account_id',
  cloudflareApiToken: 'cloudflare_api_token',
  d1DatabaseId: 'd1_database_id',
  d1DatabaseName: 'd1_database_name',
  r2BucketName: 'r2_bucket_name',
  r2AccessKeyId: 'r2_access_key_id',
  r2SecretAccessKey: 'r2_secret_access_key',
  r2Endpoint: 'r2_endpoint',
  r2BucketUrl: 'r2_bucket_url',
};

function getDb() {
  return getLocalDb();
}

export function getSettings(): AppSettings {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>;

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    storageMode: (map.get(SETTINGS_KEYS.storageMode) as StorageMode) || DEFAULT_SETTINGS.storageMode,
    cloudflareAccountId: map.get(SETTINGS_KEYS.cloudflareAccountId) || '',
    cloudflareApiToken: map.get(SETTINGS_KEYS.cloudflareApiToken) || '',
    d1DatabaseId: map.get(SETTINGS_KEYS.d1DatabaseId) || '',
    d1DatabaseName: map.get(SETTINGS_KEYS.d1DatabaseName) || '',
    r2BucketName: map.get(SETTINGS_KEYS.r2BucketName) || '',
    r2AccessKeyId: map.get(SETTINGS_KEYS.r2AccessKeyId) || '',
    r2SecretAccessKey: map.get(SETTINGS_KEYS.r2SecretAccessKey) || '',
    r2Endpoint: map.get(SETTINGS_KEYS.r2Endpoint) || '',
    r2BucketUrl: map.get(SETTINGS_KEYS.r2BucketUrl) || '',
  };
}

function normalizeR2BucketUrl(url: string): string {
  let normalized = url.trim();
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/$/, '');
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...settings };

  if (settings.r2BucketUrl !== undefined) {
    next.r2BucketUrl = normalizeR2BucketUrl(next.r2BucketUrl);
  }

  const insert = getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  );

  const entries: Array<[keyof AppSettings, string]> = [
    ['storageMode', next.storageMode],
    ['cloudflareAccountId', next.cloudflareAccountId],
    ['cloudflareApiToken', next.cloudflareApiToken],
    ['d1DatabaseId', next.d1DatabaseId],
    ['d1DatabaseName', next.d1DatabaseName],
    ['r2BucketName', next.r2BucketName],
    ['r2AccessKeyId', next.r2AccessKeyId],
    ['r2SecretAccessKey', next.r2SecretAccessKey],
    ['r2Endpoint', next.r2Endpoint],
    ['r2BucketUrl', next.r2BucketUrl],
  ];

  const transaction = getDb().transaction(() => {
    for (const [key, value] of entries) {
      insert.run(SETTINGS_KEYS[key], value);
    }
  });

  transaction();
  return next;
}

export function buildR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export async function testD1Connection(settings: AppSettings): Promise<{ ok: boolean; error?: string }> {
  if (!settings.cloudflareAccountId || !settings.cloudflareApiToken || !settings.d1DatabaseId) {
    return { ok: false, error: 'Missing D1 credentials' };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${settings.cloudflareAccountId}/d1/database/${settings.d1DatabaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: 'SELECT 1 as check_value;' }),
      }
    );

    const data = (await response.json()) as { success?: boolean; errors?: Array<{ message: string }> };

    if (!response.ok || !data.success) {
      const message = data.errors?.[0]?.message || `HTTP ${response.status}`;
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function testR2Connection(settings: AppSettings): Promise<{ ok: boolean; error?: string }> {
  if (!settings.r2Endpoint || !settings.r2AccessKeyId || !settings.r2SecretAccessKey || !settings.r2BucketName) {
    return { ok: false, error: 'Missing R2 credentials' };
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: settings.r2Endpoint,
      credentials: {
        accessKeyId: settings.r2AccessKeyId,
        secretAccessKey: settings.r2SecretAccessKey,
      },
    });

    await client.send(
      new ListObjectsV2Command({
        Bucket: settings.r2BucketName,
        MaxKeys: 1,
      })
    );

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
