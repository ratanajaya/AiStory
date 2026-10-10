import { beforeEach, expect, it, vi } from 'vitest';
import _constant from '@/utils/_constant';
import { defaultNarrationModePrompts } from '@/lib/narrationModes';

const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock('@/auth', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ KeyValueModel: { findOne: mocks.find, findOneAndUpdate: mocks.update } }));
import { GET, PUT } from './route';

const settings = { selectedTts: null, selectedLlm: _constant.defaultSelectedLlm, generationProfiles: _constant.defaultGenerationProfiles,
  apiKey: _constant.emptyApiKey, promptBuilder: { narrationSystem: 'Original system', narration2: 'Original request',
    narrationEventsSystem: 'Custom events', outlineIdeaGenerator: 'Legacy request', outlineIdeaGeneratorSystem: 'Legacy system' } };
const save = (value: unknown) => PUT(new Request('http://localhost/api/settings', { method: 'PUT', body: JSON.stringify(value) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ isAdmin: true });
  mocks.find.mockResolvedValue({ value: settings });
  mocks.update.mockImplementation(async (_filter, value) => ({ value: value.value }));
});

it('returns editable creative defaults without changing configured or deprecated prompts', async () => {
  const result = await (await GET()).json();
  expect(result.promptBuilder).toMatchObject({ ...defaultNarrationModePrompts, ...settings.promptBuilder });
});

it('retains deprecated settings while saving the new mode prompts', async () => {
  const response = await save(settings);
  expect(response.status).toBe(200);
  expect((await response.json()).promptBuilder).toMatchObject(settings.promptBuilder);
  expect(mocks.update.mock.calls[0][1].value.generationProfiles.outlineIdeaGenerator).toEqual(_constant.defaultGenerationProfiles.outlineIdeaGenerator);
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
