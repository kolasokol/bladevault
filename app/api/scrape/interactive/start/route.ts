import { NextResponse } from 'next/server'
import { startInteractiveSession } from '@/lib/scrape-interactive'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const url = typeof body.url === 'string' ? body.url.trim() : ''

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let normalizedUrl: string
    try {
      normalizedUrl = new URL(url).href
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const sessionId = await startInteractiveSession(normalizedUrl)
    return NextResponse.json({ sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
