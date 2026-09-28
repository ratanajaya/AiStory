import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG, ttsCacheConfigId } from '@/lib/ttsConfig';

const log = vi.hoisted(() => vi.fn());
vi.mock('@/lib/aiApiLog', () => ({ appendAiApiLog: log, createLogError: (error: Error) => ({ message: error.message }) }));
beforeEach(() => {
  vi.resetModules(); log.mockClear();
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['audio']), { headers: { 'Content-Type': 'audio/wav' } })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const context = { feature: 'Book audio', bookId: 'book' };
const signal = () => new AbortController().signal;

describe('chunk cache and compatibility', () => {
  it('upgrades a version-1 cache and reuses a valid long whole-segment recording', async () => {
    const content = 'x'.repeat(6000);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ai-story-tts', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('segment-audio', { keyPath: 'segmentId' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('segment-audio', 'readwrite');
        tx.objectStore('segment-audio').put({ segmentId: 's', content, configId: ttsCacheConfigId(DEFAULT_TTS_CONFIG), audioBlob: new Blob(['legacy']), mimeType: 'audio/mpeg', updatedAt: 1 });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
    const client = await import('@/lib/ttsChunkClient');
    const parts = await client.planTtsParts([{ id: 's', content }], DEFAULT_TTS_CONFIG, signal());
    expect(parts).toHaveLength(1); expect(parts[0].legacy).toBe(true);
    await client.ensureTtsPart(parts[0], context, signal());
    expect(await (await client.readTtsPart(parts[0])).text()).toBe('legacy');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('caches independent parts and reuses them on a subsequent book visit', async () => {
    const client = await import('@/lib/ttsChunkClient');
    const parts = await client.planTtsParts([{ id: 's', content: 'First.\n\nSecond.' }], DEFAULT_TTS_CONFIG, signal());
    await client.ensureTtsPart(parts[0], context, signal());
    await client.ensureTtsPart(parts[1], context, signal());
    await client.ensureTtsPart(parts[0], context, signal());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await client.readTtsPart(parts[0])).type).toBe('audio/wav');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ audio: expect.objectContaining({ cacheKey: parts[0].key, partIndex: 0, partCount: 2 }) }));
    const again = await client.planTtsParts([{ id: 's', content: 'First.\n\nSecond.' }], DEFAULT_TTS_CONFIG, signal());
    await client.ensureTtsPart(again[1], context, signal());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps content and voice variants separate and deletes all records for the segment', async () => {
    const client = await import('@/lib/ttsChunkClient'); const db = await import('@/lib/ttsIndexedDb');
    const [original] = await client.planTtsParts([{ id: 's', content: 'Original.' }], DEFAULT_TTS_CONFIG, signal());
    const [edited] = await client.planTtsParts([{ id: 's', content: 'Edited.' }], DEFAULT_TTS_CONFIG, signal());
    const [voice] = await client.planTtsParts([{ id: 's', content: 'Original.' }], { ...DEFAULT_TTS_CONFIG, voice: 'af_heart' }, signal());
    expect(new Set([original.key, edited.key, voice.key]).size).toBe(3);
    for (const part of [original, edited, voice]) await client.ensureTtsPart(part, context, signal());
    expect(await db.getChunkAudio(original.key)).toMatchObject({ content: 'Original.' });
    await db.saveSegmentAudio({ segmentId: 's', content: 'Old whole recording', configId: 'old', audioBlob: new Blob(['old']), mimeType: 'audio/mpeg', updatedAt: 1 });
    await db.deleteSegmentAudio('s');
    expect(await db.getSegmentAudio('s')).toBeNull();
    for (const part of [original, edited, voice]) expect(await db.getChunkAudio(part.key)).toBeNull();
  });

  it('does not reuse a legacy recording with different text or configuration', async () => {
    const db = await import('@/lib/ttsIndexedDb'); const client = await import('@/lib/ttsChunkClient');
    await db.saveSegmentAudio({ segmentId: 's', content: 'Old', configId: ttsCacheConfigId(DEFAULT_TTS_CONFIG), audioBlob: new Blob(['old']), mimeType: 'audio/mpeg', updatedAt: 1 });
    const [part] = await client.planTtsParts([{ id: 's', content: 'New' }], DEFAULT_TTS_CONFIG, signal());
    expect(part.legacy).toBe(false);
    await client.ensureTtsPart(part, context, signal()); expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not persist an aborted response even if the transport completes late', async () => {
    const client = await import('@/lib/ttsChunkClient'); const db = await import('@/lib/ttsIndexedDb');
    const [part] = await client.planTtsParts([{ id: 's', content: 'Hello' }], DEFAULT_TTS_CONFIG, signal());
    let respond!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
    const controller = new AbortController(); const pending = client.ensureTtsPart(part, context, controller.signal);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    controller.abort(); respond(new Response(new Blob(['late'])));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(await db.getChunkAudio(part.key)).toBeNull(); expect(log).not.toHaveBeenCalled();
  });

  it('rejects a cache transaction that aborts after the put request succeeds', async () => {
    const client = await import('@/lib/ttsChunkClient'); const db = await import('@/lib/ttsIndexedDb');
    const [part] = await client.planTtsParts([{ id: 's', content: 'Hello' }], DEFAULT_TTS_CONFIG, signal());
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(client.ensureTtsPart(part, context, signal())).rejects.toThrow('IndexedDB transaction failed');
    expect(await db.getChunkAudio(part.key)).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });
});
