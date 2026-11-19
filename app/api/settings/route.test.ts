import { beforeEach, expect, it, vi } from 'vitest';
import _constant from '@/utils/_constant';
import { defaultNarrationModePrompts } from '@/lib/narrationModes';

const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), update: vi.fn(), probe: vi.fn() }));
vi.mock('@/auth', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({
  KeyValueModel: {
    findOne: (...args: unknown[]) => {
      const doc = mocks.find(...args);
      return Object.assign(doc, { lean: () => doc });
    },
    findOneAndUpdate: mocks.update,
  },
}));
vi.mock('@/lib/modelPayloadProbe', () => ({ checkModelPayloads: mocks.probe }));
import { GET, PUT } from './route';

const settings = { selectedTts: null, selectedLlm: _constant.defaultSelectedLlm, generationProfiles: { ..._constant.defaultGenerationProfiles, outlineIdeaGenerator: _constant.defaultGenerationProfiles.default },
  apiKey: _constant.emptyApiKey, promptBuilder: { narrationSystem: 'Original system', narration2: 'Original request',
    narrationEventsSystem: 'Custom events', outlineIdeaGenerator: 'Legacy request', outlineIdeaGeneratorSystem: 'Legacy system' } };
const save = (value: unknown) => PUT(new Request('http://localhost/api/settings', { method: 'PUT', body: JSON.stringify(value) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ isAdmin: true });
  mocks.find.mockResolvedValue({ value: settings });
  mocks.update.mockImplementation(async (_filter, { $set }) => ({
    value: { ...settings, ...Object.fromEntries(Object.entries($set).map(([path, value]) => [path.slice('value.'.length), value])) },
  }));
});

it('returns editable creative defaults while dropping retired prompts', async () => {
  const result = await (await GET()).json();
  expect(result.promptBuilder).toMatchObject({ ...defaultNarrationModePrompts, narrationSystem: 'Original system', narration2: 'Original request', narrationEventsSystem: 'Custom events' });
  expect(result.promptBuilder).not.toHaveProperty('outlineIdeaGenerator');
  expect(result.promptBuilder).not.toHaveProperty('outlineIdeaGeneratorSystem');
  expect(result.generationProfiles).not.toHaveProperty('outlineIdeaGenerator');
});

it('drops retired settings while saving the new mode prompts', async () => {
  const response = await save(settings);
  expect(response.status).toBe(200);
  expect((await response.json()).promptBuilder).toHaveProperty('narrationEventsSystem', 'Custom events');
  const saved = mocks.update.mock.calls[0][1].$set;
  expect(saved['value.promptBuilder']).not.toHaveProperty('outlineIdeaGenerator');
  expect(saved['value.promptBuilder']).not.toHaveProperty('outlineIdeaGeneratorSystem');
  expect(saved['value.generationProfiles']).not.toHaveProperty('outlineIdeaGenerator');
  expect(saved).not.toHaveProperty('value.autocomplete');
  expect(mocks.probe).not.toHaveBeenCalled();
});

it('reads and saves the default autocomplete selection independently of narration', async () => {
  expect((await (await GET()).json()).autocomplete).toBeNull();
  const autocomplete = { model: { service: 'openAi', model: 'test-autocomplete' } };
  expect((await (await save({ ...settings, autocomplete })).json()).autocomplete).toEqual(autocomplete);
  expect(mocks.update.mock.calls[0][1].$set).toMatchObject({
    'value.autocomplete': autocomplete,
    'value.selectedLlm': settings.selectedLlm,
  });
  mocks.find.mockResolvedValueOnce({ value: { ...settings, autocomplete } });
  expect((await (await GET()).json()).autocomplete).toEqual(autocomplete);
  expect((await save({ ...settings, autocomplete: { model: { service: 'openAi', model: ' ' } } })).status).toBe(400);
  expect(mocks.update).toHaveBeenCalledOnce();
});

it('rejects malformed mode prompts before writing settings', async () => {
  expect((await save({ ...settings, promptBuilder: { narrationStartOnlyRequest: [] } })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});

it('keeps global prompt settings admin-only', async () => {
  mocks.user.mockResolvedValue({ isAdmin: false });
  expect((await save(settings)).status).toBe(403);
  expect((await GET()).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
});

it('checks admin candidate credentials and saves the verified shapes without returning credentials', async () => {
  const autocomplete = { model: { service: 'together', model: 'chat' } };
  const story = { ...settings.selectedLlm, shape: { allowTemperature: false } };
  const verifiedAutocomplete = { ...autocomplete.model, shape: { allowTemperature: true } };
  const apiKey = { together: 'admin-together', openAi: 'admin-openai', refuseless: null };
  mocks.probe.mockResolvedValueOnce({ ok: true, payloads: { story, autocomplete: verifiedAutocomplete } });
  const response = await save({ ...settings, autocomplete, apiKey, testModels: true });
  expect(await response.json()).toEqual({ success: true });
  expect(mocks.probe).toHaveBeenCalledWith(settings.selectedLlm, autocomplete.model, apiKey, expect.any(AbortSignal));
  expect(mocks.update.mock.calls[0][1].$set).toMatchObject({
    'value.modelPayloads.story': story,
    'value.modelPayloads.autocomplete': verifiedAutocomplete,
  });
});

it('uses stored keys for the model check when omitted and returns only configuration status', async () => {
  const selectedLlm = { service: 'refuseless', model: 'story-model' };
  const apiKey = { together: 'shared-together', openAi: 'shared-openai', refuseless: 'shared-refuseless' };
  const defaults = { ...settings, selectedLlm, apiKey };
  mocks.find.mockResolvedValue({ value: defaults });
  const response = await (await GET()).json();
  expect(response.configured).toEqual({ together: true, openAi: true, refuseless: true });
  expect(response).not.toHaveProperty('apiKey');

  mocks.probe.mockResolvedValueOnce({ ok: true, payloads: {} });
  expect((await save({ ...defaults, apiKey: { together: '', openAi: '' }, testModels: true })).status).toBe(200);
  expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, undefined, apiKey, expect.any(AbortSignal));
  expect(Object.keys(mocks.update.mock.calls[0][1].$set).some(path => path.startsWith('value.apiKey.'))).toBe(false);
});

it.each(['together', 'openAi', 'refuseless'] as const)('tests a freshly entered %s key before saving it', async service => {
  const selectedLlm = { service, model: 'new-model' };
  const story = { ...selectedLlm, shape: { allowTemperature: false } };
  mocks.probe.mockResolvedValueOnce({ ok: true, payloads: { story } });
  expect((await save({ ...settings, selectedLlm, apiKey: { [service]: ' new-key ' }, testModels: true })).status).toBe(200);
  expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, undefined, { ..._constant.emptyApiKey, [service]: 'new-key' }, expect.any(AbortSignal));
  expect(mocks.update.mock.calls[0][1].$set[`value.apiKey.${service}`]).toBe('new-key');
});
