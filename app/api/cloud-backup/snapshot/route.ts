import { NextResponse } from 'next/server';
import { LocalStorage } from '@/lib/storage/local';
import { saveSettings } from '@/lib/settings';
import { Knife } from '@/lib/data';

type SnapshotPayload = {
  knives?: Knife[];
  compareIds?: string[];
};

export async function GET(request: Request) {
  try {
    const storage = new LocalStorage();
    const [knives, compareIds] = await Promise.all([
      storage.getAllKnives(),
      storage.getCompareList(),
    ]);

    const { searchParams } = new URL(request.url);
    const inlineImages = searchParams.get('inlineImages') !== 'false';

    const exportableKnives = inlineImages
      ? await Promise.all(
          knives.map(async (knife) => {
            const images = await Promise.all(
              knife.images.map(async (image) => {
                if (
                  image.startsWith('http://') ||
                  image.startsWith('https://') ||
                  image.startsWith('data:image')
                ) {
                  return image;
                }

                const { buffer, contentType } = await storage.getImage(image);
                return `data:${contentType};base64,${buffer.toString('base64')}`;
              })
            );

            return {
              ...knife,
              images,
            };
          })
        )
      : knives;

    return NextResponse.json({
      knives: exportableKnives,
      compareIds,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as SnapshotPayload;
    const knives = Array.isArray(body.knives) ? body.knives : null;
    const compareIds = Array.isArray(body.compareIds) ? body.compareIds : null;

    if (!knives || !compareIds) {
      return NextResponse.json(
        { error: 'Snapshot must include knives and compareIds arrays' },
        { status: 400 }
      );
    }

    const storage = new LocalStorage();
    await storage.replaceAllWithSnapshot(knives, compareIds);

    saveSettings({
      cloudBackupLastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      total: knives.length,
      compareIds: compareIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
