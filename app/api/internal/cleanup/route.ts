import { NextResponse } from 'next/server';
import { cleanupReleaseUploads } from '@/lib/releaseCleanup';
import { cleanupExpiredGuests } from '@/lib/guestCleanup';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  const guests = await cleanupExpiredGuests();
  const releases = await cleanupReleaseUploads();
  const result = { ...guests, releases, failed: guests.failed + releases.failed };
  return NextResponse.json(result, { status: result.failed ? 500 : 200 });
}
