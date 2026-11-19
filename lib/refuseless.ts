import type { AiModelOption } from '@/types';
import _util from '@/utils/_util';

export const REFUSELESS_BASE_URL = 'https://api.refuseless.com/v1';

export async function fetchRefuselessModels(apiKey: string, signal: AbortSignal): Promise<AiModelOption[]> {
  const response = await fetch(`${REFUSELESS_BASE_URL}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('Refuseless model request failed.');

  const { data } = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid Refuseless model catalog.');
  return data.flatMap((item) => {
    const id = typeof item?.id === 'string' ? _util.toIdentifierString(item.id) : '';
    if (!id) return [];
    return [{
      id,
      label: id,
      contextLength: Number.isInteger(item.context_length) && item.context_length > 0 ? item.context_length : null,
    }];
  });
}
