import { getUserSettingWithFallback } from '@/auth';
import { errorResponseFromMessage } from '@/lib/apiError';
import { getActor, guestSettings } from '@/lib/guest';
import { KeyValueModel } from '@/models';
import type { DefaultValue, LLMService } from '@/types';
import _util from '@/utils/_util';

export async function getModelCatalogApiKey(request: Request, service: LLMService): Promise<string | Response> {
  const actor = await getActor();
  if (!actor) return errorResponseFromMessage('Unauthorized', 401);

  const body = await request.json().catch(() => null);
  const defaultScope = body?.scope === 'defaults';
  if (defaultScope && !actor.isAdmin) return errorResponseFromMessage('Forbidden', 403);
  if (actor.kind === 'guest') return _util.toIdentifierString((await guestSettings())?.apiKey[service]);

  const enteredKey = typeof body?.apiKey === 'string' ? _util.toIdentifierString(body.apiKey) : '';
  if (enteredKey) return enteredKey;
  // Explicit null previews clearing the scoped key; omission uses saved settings.
  const cleared = body?.apiKey === null;
  if (cleared && defaultScope) return '';
  if (defaultScope || cleared) {
    const doc = await KeyValueModel.findOne({ key: 'defaultValue' }).lean();
    return _util.toIdentifierString((doc?.value as DefaultValue | undefined)?.apiKey?.[service]);
  }
  return _util.toIdentifierString((await getUserSettingWithFallback()).apiKey[service]);
}
