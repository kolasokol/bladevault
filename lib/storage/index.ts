import { getSettings } from '@/lib/settings';
import { LocalStorage } from './local';
import { RemoteStorage } from './remote';
import { Storage } from './types';

let localInstance: LocalStorage | null = null;
let remoteInstance: RemoteStorage | null = null;
let remoteSettingsHash: string | null = null;

function hashSettings(settings: ReturnType<typeof getSettings>): string {
  return JSON.stringify({
    accountId: settings.cloudflareAccountId,
    apiToken: settings.cloudflareApiToken,
    d1Id: settings.d1DatabaseId,
    bucket: settings.r2BucketName,
    keyId: settings.r2AccessKeyId,
    secret: settings.r2SecretAccessKey,
    endpoint: settings.r2Endpoint,
    bucketUrl: settings.r2BucketUrl,
  });
}

export function getStorage(): Storage {
  const settings = getSettings();

  if (settings.storageMode === 'remote') {
    const hash = hashSettings(settings);
    if (!remoteInstance || remoteSettingsHash !== hash) {
      remoteInstance = new RemoteStorage(settings);
      remoteSettingsHash = hash;
    }
    return remoteInstance;
  }

  if (!localInstance) {
    localInstance = new LocalStorage();
  }
  return localInstance;
}

export async function initRemoteStorage(): Promise<void> {
  const settings = getSettings();
  if (settings.storageMode !== 'remote') {
    throw new Error('Remote storage is not enabled');
  }
  const storage = getStorage() as RemoteStorage;
  await storage.init();
}

export function clearStorageCache(): void {
  localInstance = null;
  remoteInstance = null;
  remoteSettingsHash = null;
}

export * from './types';
