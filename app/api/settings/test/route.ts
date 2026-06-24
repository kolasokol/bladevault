import { NextResponse } from 'next/server';
import { AppSettings, testD1Connection, testR2Connection } from '@/lib/settings';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppSettings> & { test: 'd1' | 'r2' | 'all' };
    const { test, ...settingsPartial } = body;

    const settings: AppSettings = {
      storageMode: 'remote',
      cloudflareAccountId: settingsPartial.cloudflareAccountId ?? '',
      cloudflareApiToken: settingsPartial.cloudflareApiToken ?? '',
      d1DatabaseId: settingsPartial.d1DatabaseId ?? '',
      d1DatabaseName: settingsPartial.d1DatabaseName ?? '',
      r2BucketName: settingsPartial.r2BucketName ?? '',
      r2AccessKeyId: settingsPartial.r2AccessKeyId ?? '',
      r2SecretAccessKey: settingsPartial.r2SecretAccessKey ?? '',
      r2Endpoint: settingsPartial.r2Endpoint ?? '',
      r2BucketUrl: settingsPartial.r2BucketUrl ?? '',
    };

    if (test === 'd1') {
      const result = await testD1Connection(settings);
      return NextResponse.json(result);
    }

    if (test === 'r2') {
      const result = await testR2Connection(settings);
      return NextResponse.json(result);
    }

    const [d1, r2] = await Promise.all([
      testD1Connection(settings),
      testR2Connection(settings),
    ]);

    return NextResponse.json({
      ok: d1.ok && r2.ok,
      d1,
      r2,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
