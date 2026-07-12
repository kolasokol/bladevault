import { NextResponse } from 'next/server'
import { captureInteractiveSession } from '@/lib/scrape-interactive'
import { scrapeAndEnrichProduct } from '@/lib/scrape'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { html, finalUrl } = await captureInteractiveSession(id)
    const result = await scrapeAndEnrichProduct(html, finalUrl, finalUrl)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
