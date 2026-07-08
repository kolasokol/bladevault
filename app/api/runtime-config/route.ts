import { NextResponse } from 'next/server'
import {
  FALLBACK_CLOUD_AUTH_URL,
  FALLBACK_CLOUD_BACKUP_URL,
} from '@/lib/cloud-backup'

function readPublicEnv(
  name: 'NEXT_PUBLIC_BLADEVAULT_AUTH_URL' | 'NEXT_PUBLIC_BLADEVAULT_BACKUP_URL',
) {
  return process.env[name]?.trim() || ''
}

export async function GET() {
  return NextResponse.json(
    {
      authUrl:
        readPublicEnv('NEXT_PUBLIC_BLADEVAULT_AUTH_URL') ||
        FALLBACK_CLOUD_AUTH_URL,
      backupUrl:
        readPublicEnv('NEXT_PUBLIC_BLADEVAULT_BACKUP_URL') ||
        FALLBACK_CLOUD_BACKUP_URL,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
