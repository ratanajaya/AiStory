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
});
