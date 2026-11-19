import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), find: vi.fn(), defaults: vi.fn(), probe: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('@/models', () => ({ UserModel: { updateOne: mocks.update, findOne: () => ({ lean: mocks.find }) }, KeyValueModel: { findOne: () => ({ lean: mocks.defaults }) } }));
vi.mock('@/lib/modelPayloadProbe', () => ({ checkModelPayloads: mocks.probe }));
import { GET, PUT } from './route';
const config = { service: 'openAi', model: 'tts-1', voice: 'alloy' };
const put = (body: unknown) => PUT(new Request('http://localhost/api/user/settings', { method: 'PUT', body: JSON.stringify(body) }));
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { email: 'owner@example.com' } }); mocks.update.mockResolvedValue({ matchedCount: 1 }); mocks.find.mockResolvedValue({ selectedTts: config }); });
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
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, autocomplete.model, { openAi: 'new-key', together: 'existing-personal-key' }, expect.any(AbortSignal));
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
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, autocomplete.model, { openAi: 'new-key', together: 'existing-personal-key' }, expect.any(AbortSignal));
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
