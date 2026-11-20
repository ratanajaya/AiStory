import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), find: vi.fn(), defaults: vi.fn(), probe: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('@/models', () => ({ UserModel: { updateOne: mocks.update, findOne: () => ({ lean: mocks.find }) }, KeyValueModel: { findOne: () => ({ lean: mocks.defaults }) } }));
vi.mock('@/lib/modelPayloadProbe', () => ({ checkModelPayloads: mocks.probe }));
import { GET, PUT } from './route';
const config = { service: 'openAi', model: 'tts-1', voice: 'alloy' };
const put = (body: unknown) => PUT(new Request('http://localhost/api/user/settings', { method: 'PUT', body: JSON.stringify(body) }));
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { email: 'owner@example.com' } }); mocks.update.mockResolvedValue({ matchedCount: 1 }); mocks.find.mockResolvedValue({ selectedTts: config }); mocks.defaults.mockResolvedValue(null); });
describe('account TTS preferences', () => {
  it('loads and narrowly updates only the authenticated account', async () => {
    expect((await (await GET()).json()).selectedTts).toEqual(config);
    expect((await put({ selectedTts: config, ownerEmail: 'other', isAdmin: true })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ email: 'owner@example.com' }, { $set: { selectedTts: config } });
  });
  it('clears preferences for fallback and rejects incomplete configurations', async () => {
    await put({ selectedTts: null });
    expect(mocks.update).toHaveBeenCalledWith(expect.any(Object), { $set: { selectedTts: null } });
    expect((await put({ selectedTts: { ...config, voice: ' ' } })).status).toBe(400);
    expect(mocks.update).toHaveBeenCalledOnce();
  });
  it('requires authentication', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await put({ selectedTts: config })).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('account autocomplete preferences', () => {
  const autocomplete = { model: { service: 'together', model: 'org/test-chat' } };

  it.each([autocomplete, { model: null }, null])('saves %j for the current account', async preference => {
    mocks.find.mockResolvedValueOnce({ autocomplete: preference });
    expect((await (await GET()).json()).autocomplete).toEqual(preference);
    expect((await put({ autocomplete: preference, isAdmin: true })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ email: 'owner@example.com' }, { $set: { autocomplete: preference } });
  });

  it('rejects invalid preferences', async () => {
    expect((await put({ autocomplete: { model: { service: 'mistral', model: 'test' } } })).status).toBe(400);
    expect((await put({ autocomplete: {} })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('account model checks', () => {
  const selectedLlm = { service: 'openAi', model: 'gpt-6-luna' };
  const autocomplete = { model: { service: 'together', model: 'org/test-chat' } };
  const story = { ...selectedLlm, shape: { allowTemperature: false } };
  const verifiedAutocomplete = { ...autocomplete.model, shape: { allowTemperature: true } };

  it('saves without checking or accepting client-supplied shape records', async () => {
    expect((await put({ selectedLlm, autocomplete, modelPayloads: { story } })).status).toBe(200);
    expect(mocks.probe).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][1].$set).toEqual({ selectedLlm, autocomplete });
  });

  it('checks the candidate key and existing personal key before saving both shapes with the settings', async () => {
    mocks.find.mockResolvedValueOnce({ apiKey: { openAi: 'old-key', together: 'existing-personal-key' } });
    mocks.probe.mockResolvedValueOnce({ ok: true, payloads: { story, autocomplete: verifiedAutocomplete } });
    const response = await put({ testModels: true, selectedLlm, autocomplete, apiKey: { openAi: ' new-key ' } });
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, autocomplete.model, { openAi: 'new-key', together: 'existing-personal-key', refuseless: null }, expect.any(AbortSignal));
    expect(mocks.update).toHaveBeenCalledWith({ email: 'owner@example.com' }, { $set: {
      selectedLlm, autocomplete, 'apiKey.openAi': 'new-key', 'modelPayloads.story': story, 'modelPayloads.autocomplete': verifiedAutocomplete,
    } });
  });

  it('keeps the previous settings when autocomplete fails and uses personal keys for inherited story selection', async () => {
    mocks.find.mockResolvedValueOnce({ apiKey: { openAi: 'old-key', together: 'existing-personal-key' } });
    mocks.defaults.mockResolvedValueOnce({ value: { selectedLlm, apiKey: { openAi: 'shared-key' } } });
    mocks.probe.mockResolvedValueOnce({ ok: false, status: 502, message: 'Autocomplete model check failed.' });
    const response = await put({ testModels: true, selectedLlm: null, autocomplete, apiKey: { openAi: 'new-key' } });
    expect(response.status).toBe(502);
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, autocomplete.model, { openAi: 'new-key', together: 'existing-personal-key', refuseless: null }, expect.any(AbortSignal));
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

it('returns only the account keys for prefilling and clears explicit blank keys', async () => {
  mocks.find.mockResolvedValue({ apiKey: { together: 'together-key', openAi: 'openai-key', refuseless: 'saved-key' } });
  mocks.defaults.mockResolvedValue({ value: { apiKey: { openAi: 'global-secret' } } });
  const result = await GET();
  expect(result.headers.get('cache-control')).toBe('no-store');
  const response = await result.json();
  expect(response.configured).toEqual({ together: true, openAi: true, refuseless: true });
  expect(response.apiKey).toEqual({ together: 'together-key', openAi: 'openai-key', refuseless: 'saved-key' });
  expect(mocks.defaults).not.toHaveBeenCalled();

  const selectedLlm = { service: 'refuseless', model: 'story-model' };
  expect((await put({ selectedLlm, apiKey: { together: 'other-key', refuseless: '  ' } })).status).toBe(200);
  expect(mocks.update.mock.calls[0][1].$set).toEqual({ selectedLlm, 'apiKey.together': 'other-key', 'apiKey.refuseless': null });
  expect((await put({ apiKey: { refuseless: null } })).status).toBe(200);
  expect(mocks.update.mock.calls[1][1].$set).toEqual({ 'apiKey.refuseless': null });
});

it('checks a newly submitted Refuseless key in the same request as the story model', async () => {
  const selectedLlm = { service: 'refuseless', model: 'story-model' };
  const story = { ...selectedLlm, shape: { allowTemperature: true } };
  mocks.find.mockResolvedValueOnce({ apiKey: { openAi: 'saved-openai' } });
  mocks.probe.mockResolvedValueOnce({ ok: true, payloads: { story } });
  expect((await put({ selectedLlm, apiKey: { refuseless: ' new-key ' }, testModels: true })).status).toBe(200);
  expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, {
    together: null, openAi: 'saved-openai', refuseless: 'new-key',
  }, expect.any(AbortSignal));
  expect(mocks.update.mock.calls[0][1].$set).toEqual({
    selectedLlm, 'apiKey.refuseless': 'new-key', 'modelPayloads.story': story,
  });
});

describe.each(['openAi', 'together', 'refuseless'] as const)('%s credential fallback', service => {
  const selectedLlm = { service, model: 'story-model' };
  const story = { ...selectedLlm, shape: { allowTemperature: true } };

  beforeEach(() => {
    mocks.find.mockResolvedValue({ selectedLlm, apiKey: {} });
    mocks.defaults.mockResolvedValue({ value: { selectedLlm, apiKey: { [service]: ' global-key ' } } });
    mocks.probe.mockResolvedValue({ ok: true, payloads: { story } });
  });

  it('tests with the global key without saving it as a personal key', async () => {
    expect((await put({ testModels: true })).status).toBe(200);
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, expect.objectContaining({ [service]: 'global-key' }), expect.any(AbortSignal));
    expect(mocks.update.mock.calls[0][1].$set).toEqual({ 'modelPayloads.story': story });
  });

  it('keeps using an omitted saved personal key', async () => {
    mocks.find.mockResolvedValue({ selectedLlm, apiKey: { [service]: 'personal-key' } });
    expect((await put({ testModels: true })).status).toBe(200);
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, expect.objectContaining({ [service]: 'personal-key' }), expect.any(AbortSignal));
    expect(mocks.update.mock.calls[0][1].$set).toEqual({ 'modelPayloads.story': story });
  });

  it('tests the submitted key before saving it', async () => {
    mocks.find.mockResolvedValue({ selectedLlm, apiKey: { [service]: 'old-key' } });
    expect((await put({ testModels: true, apiKey: { [service]: ' new-key ' } })).status).toBe(200);
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, expect.objectContaining({ [service]: 'new-key' }), expect.any(AbortSignal));
    expect(mocks.update.mock.calls[0][1].$set).toEqual({ [`apiKey.${service}`]: 'new-key', 'modelPayloads.story': story });
  });

  it.each([null, '', '   '])('tests the global fallback when clearing a personal key with %j', async value => {
    mocks.find.mockResolvedValue({ selectedLlm, apiKey: { [service]: 'old-key' } });
    expect((await put({ testModels: true, apiKey: { [service]: value } })).status).toBe(200);
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, expect.objectContaining({ [service]: 'global-key' }), expect.any(AbortSignal));
    expect(mocks.update.mock.calls[0][1].$set).toEqual({ [`apiKey.${service}`]: null, 'modelPayloads.story': story });
  });

  it('reports a missing key only when personal and global keys are both unset', async () => {
    const { checkModelPayloads } = await vi.importActual<typeof import('@/lib/modelPayloadProbe')>('@/lib/modelPayloadProbe');
    mocks.probe.mockImplementationOnce(checkModelPayloads);
    mocks.defaults.mockResolvedValue({ value: { selectedLlm, apiKey: {} } });
    const response = await put({ testModels: true });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('API key to test the story model');
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

it.each([undefined, null])('tests inherited autocomplete with its global key (%j)', async autocomplete => {
  const selectedLlm = { service: 'refuseless', model: 'personal-story' };
  const model = { service: 'openAi', model: 'global-autocomplete' };
  mocks.find.mockResolvedValue({ selectedLlm, apiKey: { refuseless: 'personal-key' } });
  mocks.defaults.mockResolvedValue({ value: { autocomplete: { model }, apiKey: { openAi: 'global-key' } } });
  mocks.probe.mockResolvedValue({ ok: true, payloads: {} });
  expect((await put({ testModels: true, autocomplete })).status).toBe(200);
  expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, model, { refuseless: 'personal-key', openAi: 'global-key', together: null }, expect.any(AbortSignal));
});

it('respects explicitly disabled autocomplete', async () => {
  const selectedLlm = { service: 'together', model: 'story' };
  mocks.find.mockResolvedValue({ selectedLlm });
  mocks.defaults.mockResolvedValue({ value: { autocomplete: { model: { service: 'openAi', model: 'global-autocomplete' } } } });
  mocks.probe.mockResolvedValue({ ok: true, payloads: {} });
  expect((await put({ testModels: true, autocomplete: { model: null } })).status).toBe(200);
  expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, expect.any(Object), expect.any(AbortSignal));
});

it('does not save candidate settings when a model check is canceled', async () => {
  const controller = new AbortController();
  mocks.probe.mockImplementationOnce(async () => {
    controller.abort();
    return { ok: true, payloads: {} };
  });
  const response = await PUT(new Request('http://localhost/api/user/settings', {
    method: 'PUT', signal: controller.signal,
    body: JSON.stringify({ testModels: true, apiKey: { openAi: 'candidate-key' } }),
  }));
  expect(response.status).toBe(499);
  expect(mocks.update).not.toHaveBeenCalled();
});
