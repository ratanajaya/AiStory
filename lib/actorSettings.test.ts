import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultGenerationProfiles } from '@/lib/generationProfiles';

const mocks = vi.hoisted(() => ({ user: vi.fn(), defaults: vi.fn() }));
vi.mock('next-auth', () => ({ default: () => ({ auth: async () => ({ user: { email: 'reader@example.com' } }) }) }));
vi.mock('@/lib/authSessionOverride', () => ({ getAuthSessionOverrideUser: () => null }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('@/lib/guest', () => ({ getActor: async () => ({ kind: 'user', ownerEmail: 'reader@example.com' }) }));
vi.mock('@/models', () => ({ UserModel: { findOne: mocks.user }, KeyValueModel: { findOne: mocks.defaults } }));

import { getActorGenerationSettings } from '@/lib/actorSettings';

describe('account generation credentials and funding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.defaults.mockResolvedValue({ value: {
      selectedLlm: { service: 'together', model: 'default-model' },
      apiKey: { together: 'app-together', openAi: 'app-openai' },
      generationProfiles: getDefaultGenerationProfiles(),
    } });
  });

  it.each([null, '', '   ', 'personal-openai'])('derives funding and credentials from one account read (%j)', async (key) => {
    mocks.user.mockResolvedValueOnce({ trialAccount: true, selectedLlm: null, apiKey: { openAi: key } });
    // A concurrent save would change the next read; it must not affect this snapshot.
    mocks.user.mockResolvedValue({ trialAccount: true, apiKey: { together: 'new-key', openAi: 'new-key' } });

    const settings = await getActorGenerationSettings();

    expect(settings).toMatchObject({
      selectedLlm: { service: 'together', model: 'default-model' },
      apiKey: { together: 'app-together', openAi: key === 'personal-openai' ? key : 'app-openai' },
      personal: { together: false, openAi: key === 'personal-openai' },
      trialAccount: true,
    });
    expect(mocks.user).toHaveBeenCalledTimes(1);
  });

  it.each([null, '   ', ' personal-refuseless '])('uses the same credential fallback for Refuseless (%j)', async key => {
    const selectedLlm = { service: 'refuseless', model: 'story-model' };
    mocks.defaults.mockResolvedValueOnce({ value: { selectedLlm, apiKey: { refuseless: ' app-refuseless ' } } });
    mocks.user.mockResolvedValueOnce({ apiKey: { refuseless: key } });
    const settings = await getActorGenerationSettings();
    expect(settings).toMatchObject({
      selectedLlm,
      apiKey: { refuseless: key?.trim() || 'app-refuseless' },
      personal: { refuseless: Boolean(key?.trim()) },
    });
  });

  it.each([
    [undefined, { service: 'openAi', model: 'default-autocomplete' }],
    [{ model: null }, null],
    [{ model: { service: 'together', model: 'account-autocomplete' } }, { service: 'together', model: 'account-autocomplete' }],
  ])('resolves an account autocomplete preference of %j', async (autocomplete, expected) => {
    mocks.defaults.mockResolvedValueOnce({ value: {
      selectedLlm: { service: 'together', model: 'default-model' },
      apiKey: {},
      autocomplete: { model: { service: 'openAi', model: 'default-autocomplete' } },
    } });
    mocks.user.mockResolvedValueOnce({ autocomplete });
    expect((await getActorGenerationSettings()).autocompleteModel).toEqual(expected);
  });

  it('resolves verified payloads from the same settings as each effective model', async () => {
    const selectedLlm = { service: 'together', model: 'default-model' };
    const autocomplete = { model: { service: 'openAi', model: 'gpt-6-luna' } };
    const systemStoryShape = { allowTemperature: true };
    const actorStoryShape = { allowTemperature: false };
    const autocompleteShape = { allowTemperature: false, reasoning: 'openai-medium' };
    mocks.defaults.mockResolvedValueOnce({ value: {
      selectedLlm, autocomplete, apiKey: {}, modelPayloads: {
        story: { ...selectedLlm, shape: systemStoryShape },
        autocomplete: { ...autocomplete.model, shape: autocompleteShape },
      },
    } });
    mocks.user.mockResolvedValueOnce({ modelPayloads: {
      story: { ...selectedLlm, shape: actorStoryShape },
      autocomplete: { service: 'openAi', model: 'stale-autocomplete', shape: { allowTemperature: true } },
    } });
    expect(await getActorGenerationSettings()).toMatchObject({ storyPayload: actorStoryShape, autocompletePayload: autocompleteShape });
  });
});
