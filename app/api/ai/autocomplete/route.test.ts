import { beforeEach, expect, it, vi } from 'vitest';
import { autocompleteProfile } from '@/lib/autocomplete';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  settings: vi.fn(),
  bookExists: vi.fn(),
  endpoint: vi.fn(),
  completion: vi.fn(),
  reserveTrial: vi.fn(),
}));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, sameOrigin: () => true }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: mocks.settings }));
vi.mock('@/lib/aiEndpointDynamic', () => ({ createConfiguredAiEndpoint: mocks.endpoint }));
vi.mock('@/models', () => ({ BookModel: { exists: mocks.bookExists } }));
vi.mock('@/lib/trial', () => ({ reserveTrial: mocks.reserveTrial }));

import { POST } from './route';

const guest = { kind: 'guest', isAdmin: false, filter: { guestId: 'guest-1' } };
const user = { kind: 'user', isAdmin: false, filter: { ownerEmail: 'reader@example.com' } };
const model = { service: 'openAi', model: 'test-autocomplete' };
const draft = { bookId: 'book-1', draftTail: 'Mara opens the window' };
const settings = {
  autocompleteModel: model,
  autocompletePayload: { allowTemperature: false, reasoning: 'openai-medium' },
  personal: { openAi: true, together: false },
  apiKey: { openAi: 'personal-openai', together: 'app-together' },
};
function request(body: unknown = draft, signal?: AbortSignal) {
  return new Request('http://localhost/api/ai/autocomplete', { method: 'POST', body: JSON.stringify(body), signal });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue(guest);
  mocks.settings.mockResolvedValue(settings);
  mocks.bookExists.mockResolvedValue({ _id: 'book-object-id' });
  mocks.endpoint.mockReturnValue({ chatCompletionFull: mocks.completion });
  mocks.completion.mockResolvedValue(' and sees the tide rising.');
});

it.each([guest, user])('uses the matching personal key for a $kind and leaves the trial alone', async actor => {
  mocks.actor.mockResolvedValue(actor);
  const input = request();
  const response = await POST(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ suffix: ' and sees the tide rising.' });
  expect(mocks.bookExists).toHaveBeenCalledWith({ bookId: 'book-1', ...actor.filter });
  expect(mocks.endpoint).toHaveBeenCalledWith(model, 'personal-openai', false, settings.autocompletePayload);
  const [, messages, profile, options] = mocks.completion.mock.calls[0];
  expect(messages).toEqual([{ role: 'user', content: draft.draftTail }]);
  expect(profile).toBe(autocompleteProfile);
  expect(options.abortSignal).toBe(input.signal);
  expect(mocks.reserveTrial).not.toHaveBeenCalled();
});

it.each([guest, user])('rejects the app key for a $kind with a personal key for a different provider', async actor => {
  mocks.actor.mockResolvedValue(actor);
  mocks.settings.mockResolvedValue({ ...settings, personal: { openAi: false, together: true } });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.endpoint).not.toHaveBeenCalled();
  expect(mocks.reserveTrial).not.toHaveBeenCalled();
});

it('allows a signed-in admin to use the app key for the selected provider', async () => {
  mocks.actor.mockResolvedValue({ ...user, isAdmin: true });
  mocks.settings.mockResolvedValue({
    ...settings,
    personal: { openAi: false, together: true },
    apiKey: { openAi: 'app-openai', together: 'personal-together' },
  });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.endpoint).toHaveBeenCalledWith(model, 'app-openai', false, settings.autocompletePayload);
  expect(mocks.reserveTrial).not.toHaveBeenCalled();
});

it('ignores context and mode fields sent by an older editor', async () => {
  const input = { ...draft, includeStoryContext: true, mode: 'startOnly' };
  expect((await POST(request(input))).status).toBe(200);
  expect(mocks.completion.mock.calls[0][1]).toEqual([{ role: 'user', content: draft.draftTail }]);
});

it('rejects unauthenticated, malformed, disabled, and unowned requests before generation', async () => {
  mocks.actor.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request({ ...draft, bookId: ' ' }))).status).toBe(400);
  expect((await POST(request({ ...draft, draftTail: 'x'.repeat(4_001) }))).status).toBe(400);
  mocks.settings.mockResolvedValueOnce({ ...settings, autocompleteModel: null });
  expect((await POST(request())).status).toBe(403);
  mocks.bookExists.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(404);
  expect(mocks.endpoint).not.toHaveBeenCalled();
});

it('caps suffix length, ignores echoed or empty output, and sanitizes provider errors', async () => {
  mocks.completion.mockResolvedValueOnce(draft.draftTail + ' and looks outside.');
  expect(await (await POST(request())).json()).toEqual({ suffix: '' });
  mocks.completion.mockResolvedValueOnce('   ');
  expect(await (await POST(request())).json()).toEqual({ suffix: '' });
  mocks.completion.mockResolvedValueOnce(' ' + '🙂'.repeat(180));
  expect(await (await POST(request())).json()).toEqual({ suffix: ' ' + '🙂'.repeat(159) });
  mocks.completion.mockRejectedValueOnce(new Error('provider key and request content'));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('provider key and request content');
});

it('avoids provider generation if the request has already been canceled', async () => {
  const controller = new AbortController();
  const input = request(draft, controller.signal);
  controller.abort();
  expect((await POST(input)).status).toBe(499);
  expect(mocks.endpoint).not.toHaveBeenCalled();
});
