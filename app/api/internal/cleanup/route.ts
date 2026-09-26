import { NextResponse } from 'next/server';
import { cleanupExpiredGuests } from '@/lib/guestCleanup';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  const result = await cleanupExpiredGuests();
  return NextResponse.json(result, { status: result.failed ? 500 : 200 });
}
