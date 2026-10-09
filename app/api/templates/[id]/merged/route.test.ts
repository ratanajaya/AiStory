import { beforeEach, expect, it, vi } from 'vitest';
import { defaultNarrationModePrompts } from '@/lib/narrationModes';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), template: vi.fn(), defaults: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ TemplateModel: { findOne: mocks.template }, KeyValueModel: { findOne: mocks.defaults } }));
import { GET } from './route';
const get = () => GET(new Request('http://localhost/api/templates/t1/merged'), { params: Promise.resolve({ id: 't1' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: false, filter: { ownerEmail: 'owner@example.com' } });
});

it('merges creative overrides with global and built-in defaults within actor ownership', async () => {
  const promptBuilder = { narrationSystem: 'Original', narrationStartEndSystem: 'Template system', narrationStartEndRequest: ' ' };
  mocks.template.mockResolvedValue({ promptBuilder, toObject: () => ({ templateId: 't1', promptBuilder }) });
  mocks.defaults.mockResolvedValue({ value: { promptBuilder: { narrationStartEndRequest: 'Global request', narrationEventsSystem: null } } });
  const response = await get();
  expect(response.status).toBe(200);
  expect((await response.json()).promptBuilder).toMatchObject({ narrationSystem: 'Original', narrationStartEndSystem: 'Template system',
    narrationStartEndRequest: 'Global request', narrationEventsSystem: defaultNarrationModePrompts.narrationEventsSystem });
  expect(mocks.template).toHaveBeenCalledWith({ templateId: 't1', ownerEmail: 'owner@example.com' });
});

it('enables creative modes without a global defaults document', async () => {
  mocks.template.mockResolvedValue({ promptBuilder: {}, toObject: () => ({ templateId: 't1' }) });
  mocks.defaults.mockResolvedValue(null);
  expect((await (await get()).json()).promptBuilder).toMatchObject(defaultNarrationModePrompts);
});
