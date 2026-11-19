import { NextResponse } from 'next/server';
import { getUserSettingWithFallback } from '@/auth';
import { errorResponseFromMessage } from '@/lib/apiError';
import { getActor, guestSettings } from '@/lib/guest';
import dbConnect from '@/lib/mongodb';
import { fetchRefuselessModels } from '@/lib/refuseless';
import { KeyValueModel } from '@/models';
import type { DefaultValue } from '@/types';
import _util from '@/utils/_util';

export async function POST(request: Request) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const body = await request.json().catch(() => null);
    const defaultScope = body?.scope === 'defaults';
    if (defaultScope && !actor.isAdmin) return errorResponseFromMessage('Forbidden', 403);

    let apiKey: string;
    if (actor.kind === 'guest') {
      const settings = await guestSettings();
      apiKey = _util.toIdentifierString(settings?.apiKey.refuseless);
    } else {
      apiKey = typeof body?.apiKey === 'string' ? _util.toIdentifierString(body.apiKey) : '';
      if (!apiKey && defaultScope) {
        await dbConnect();
        const doc = await KeyValueModel.findOne({ key: 'defaultValue' }).lean();
        apiKey = _util.toIdentifierString((doc?.value as DefaultValue | undefined)?.apiKey?.refuseless);
      } else if (!apiKey) {
        const settings = await getUserSettingWithFallback();
        apiKey = _util.toIdentifierString(settings.apiKey.refuseless);
      }
    }

    const models = await fetchRefuselessModels(apiKey, request.signal);
    return NextResponse.json({ models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return errorResponseFromMessage('Could not load Refuseless models. Check your API key and try again.', 502);
  }
}
