import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ workspace: vi.fn(), settings: vi.fn(), update: vi.fn(), encrypt: vi.fn(), decrypt: vi.fn(), probe: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getGuestWorkspace: mocks.workspace, guestSettings: mocks.settings, encryptGuestKey: mocks.encrypt, decryptGuestKey: mocks.decrypt, sameOrigin: () => true }));
vi.mock('@/models', () => ({ GuestWorkspaceModel: { updateOne: mocks.update } }));
vi.mock('@/lib/modelPayloadProbe', () => ({ checkModelPayloads: mocks.probe }));
import { GET, PUT } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue({ guestId: 'guest-one' });
  mocks.settings.mockResolvedValue({ guest: { selectedTts: null }, selectedLlm: null, apiKey: { together: 'secret', openAi: null } });
  mocks.update.mockResolvedValue({ matchedCount: 1 });
  mocks.encrypt.mockImplementation((key: string) => `encrypted:${key}`);
});
const put = (body: unknown) => PUT(new Request('http://localhost/api/guest/settings', { method: 'PUT', body: JSON.stringify(body) }));

describe('guest credentials', () => {
  it('saves and clears TTS without touching keys or text settings', async () => {
    const config = { service: 'openAi', model: 'tts-1', voice: 'alloy' };
    expect((await put({ selectedTts: config })).status).toBe(200);
    expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { selectedTts: config } });
    expect((await put({ selectedTts: null })).status).toBe(200);
    expect(mocks.update.mock.calls[1][1]).toEqual({ $set: { selectedTts: null } });
    expect((await put({ selectedTts: { ...config, voice: '' } })).status).toBe(400);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it('returns configured flags without saved secrets', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ selectedTts: null, selectedLlm: null, configured: { together: true, openAi: false } });
  });
  it('encrypts a replacement and preserves omitted providers', async () => {
    expect((await put({ apiKey: { openAi: '  new-key  ' } })).status).toBe(200);
    expect(mocks.encrypt).toHaveBeenCalledWith('new-key');
    expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { 'encryptedKeys.openAi': 'encrypted:new-key' } });
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ guestId: 'guest-one', state: 'active' });
  });
  it.each([null, '', '  '])('removes an explicitly unset key (%s)', async (value) => {
    await put({ apiKey: { together: value } });
    expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { 'encryptedKeys.together': null } });
    expect(mocks.encrypt).not.toHaveBeenCalled();
  });
  it('rejects invalid keys before writing', async () => {
    expect((await put({ apiKey: { together: 123 } })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('denies expired guests', async () => {
    mocks.workspace.mockResolvedValue(null);
    expect((await put({ apiKey: { together: 'key' } })).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('writes the verified story payload with the encrypted candidate key', async () => {
    const selectedLlm = { service: 'together', model: 'guest-chat' };
    const story = { ...selectedLlm, shape: { allowTemperature: false } };
    mocks.probe.mockResolvedValueOnce({ ok: true, payloads: { story } });
    expect((await put({ testModels: true, selectedLlm, apiKey: { together: 'personal' } })).status).toBe(200);
    expect(mocks.probe).toHaveBeenCalledWith(selectedLlm, null, { together: 'personal', openAi: '' }, expect.any(AbortSignal));
    expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { selectedLlm, 'encryptedKeys.together': 'encrypted:personal', 'modelPayloads.story': story } });
  });

  it('keeps an expired or claimed workspace from being updated after a check', async () => {
    const selectedLlm = { service: 'together', model: 'guest-chat' };
    mocks.workspace.mockResolvedValueOnce({ guestId: 'guest-one', encryptedKeys: { together: 'encrypted' } });
    mocks.decrypt.mockReturnValueOnce('personal');
    mocks.probe.mockResolvedValueOnce({ ok: true, payloads: { story: { ...selectedLlm, shape: { allowTemperature: false } } } });
    mocks.update.mockResolvedValueOnce({ matchedCount: 0 });
    expect((await put({ testModels: true, selectedLlm })).status).toBe(401);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ guestId: 'guest-one', state: 'active', expiresAt: { $gt: expect.any(Date) } });
  });
});
