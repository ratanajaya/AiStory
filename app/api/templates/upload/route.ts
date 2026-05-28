import { NextResponse } from 'next/server';
import shortid from 'shortid';
import { auth } from '@/auth';
import { uploadImage } from '@/lib/gcs';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return errorResponseFromMessage('Unauthorized', 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponseFromMessage('No file provided', 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponseFromMessage(
        'Invalid file type. Allowed: JPEG, PNG, WebP, GIF',
        400,
      );
    }

    if (file.size > MAX_SIZE) {
      return errorResponseFromMessage('File too large. Max size: 5MB', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${shortid.generate()}.${ext}`;

    const imageUrl = await uploadImage(buffer, fileName, file.type);

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
