import { NextResponse } from 'next/server';
import { getLocalDataDirPath } from '@/lib/local-db';
import { AppSettings, getSettings, saveSettings } from '@/lib/settings';

export async function GET() {
  try {
    const settings = getSettings();
    const localDataPath = getLocalDataDirPath();
    return NextResponse.json({ settings, localDataPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppSettings>;
    const settings = saveSettings(body);
    const localDataPath = getLocalDataDirPath();
    return NextResponse.json({ settings, localDataPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
