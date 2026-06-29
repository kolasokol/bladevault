import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET() {
  try {
    const storage = getStorage();
    const compareIds = await storage.getCompareList();
    return NextResponse.json({ compareIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Knife id is required' }, { status: 400 });
    }

    const storage = getStorage();
    const knife = await storage.getKnifeById(id);
    if (!knife) {
      return NextResponse.json({ error: 'Knife not found' }, { status: 404 });
    }

    await storage.addToCompare(id);
    const compareIds = await storage.getCompareList();
    return NextResponse.json({ compareIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    let id: string | null = null;
    try {
      const body = await request.json();
      id = typeof body?.id === 'string' ? body.id : null;
    } catch {
      id = null;
    }

    const storage = getStorage();
    if (id) {
      await storage.removeFromCompare(id);
    } else {
      await storage.clearCompareList();
    }
    const compareIds = await storage.getCompareList();
    return NextResponse.json({ compareIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
