import { NextResponse } from 'next/server';

function readPublicEnv(name: 'NEXT_PUBLIC_BLADEVAULT_AUTH_URL' | 'NEXT_PUBLIC_BLADEVAULT_BACKUP_URL') {
  return process.env[name]?.trim() || '';
}

export async function GET() {
  return NextResponse.json(
    {
      authUrl: readPublicEnv('NEXT_PUBLIC_BLADEVAULT_AUTH_URL'),
      backupUrl: readPublicEnv('NEXT_PUBLIC_BLADEVAULT_BACKUP_URL'),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
