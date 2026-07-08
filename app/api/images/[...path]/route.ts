import { NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await params
    const relativePath = segments.join('/')
    const storage = getStorage()
    const { buffer, contentType } = await storage.getImage(relativePath)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}
