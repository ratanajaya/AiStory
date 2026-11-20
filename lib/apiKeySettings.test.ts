import { describe, expect, it } from 'vitest';
import { resolveApiKeys, validateApiKeyUpdates } from '@/lib/apiKeySettings';

describe.each(['openAi', 'together', 'refuseless'] as const)('%s API key updates', service => {
  it.each([null, '', '   '])('clears an explicit unset value in settings (%j)', value => {
    expect(validateApiKeyUpdates({ [service]: value }, { blankMeansClear: true })).toEqual({ ok: true, value: { [service]: null } });
    expect(resolveApiKeys({ [service]: value }, { [service]: ' global-key ' })[service]).toBe('global-key');
  });

  it('preserves omitted providers and trims replacements', () => {
    expect(validateApiKeyUpdates({ [service]: ' new-key ' }, { blankMeansClear: true })).toEqual({ ok: true, value: { [service]: 'new-key' } });
    expect(validateApiKeyUpdates(undefined, { blankMeansClear: true })).toEqual({ ok: true, value: {} });
  });

  it.each([123, {}, ['key'], 'x'.repeat(513)])('rejects an invalid key', value => {
    expect(validateApiKeyUpdates({ [service]: value }, { blankMeansClear: true }).ok).toBe(false);
  });

  it.each(['', '   '])('preserves the guest blank-input contract (%j)', value => {
    expect(validateApiKeyUpdates({ [service]: value })).toEqual({ ok: true, value: {} });
  });
});
