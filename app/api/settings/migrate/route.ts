import path from 'path';
import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { LocalStorage } from '@/lib/storage/local';
import { RemoteStorage } from '@/lib/storage/remote';

export async function POST() {
  try {
    const settings = getSettings();

    if (settings.storageMode !== 'remote') {
      return NextResponse.json(
        { error: 'Switch storage mode to Remote before migrating' },
        { status: 400 }
      );
    }

    const localStorage = new LocalStorage();
    const remoteStorage = new RemoteStorage(settings);
    await remoteStorage.init();

    const localKnives = await localStorage.getAllKnives();
    const remoteKnives = await remoteStorage.getAllKnives();

    const localIds = new Set(localKnives.map((k) => k.id));
    const staleKnives = remoteKnives.filter((k) => !localIds.has(k.id));

    for (const knife of staleKnives) {
      try {
        await remoteStorage.deleteKnife(knife.id);
      } catch {
        // Best-effort cleanup of stale remote items.
      }
    }

    const localCompareIds = await localStorage.getCompareList();

    const result = {
      total: localKnives.length,
      migrated: 0,
      cleanedUp: staleKnives.length,
      failed: 0,
      errors: [] as string[],
    };

    for (const knife of localKnives) {
      try {
        const remoteImages: string[] = [];

        for (const imagePath of knife.images) {
          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            remoteImages.push(imagePath);
            continue;
          }

          const { buffer, contentType } = await localStorage.getImage(imagePath);
          const filename = path.basename(imagePath);
          const key = `${knife.id}/${filename}`;
          const publicUrl = await remoteStorage.uploadImage(key, buffer, contentType);
          remoteImages.push(publicUrl);
        }

        await remoteStorage.migrateKnife(knife, remoteImages);
        result.migrated += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(
          `${knife.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    try {
      await remoteStorage.clearCompareList();
      await remoteStorage.migrateCompareList(localCompareIds);
    } catch {
      /* empty */
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
