import { describe, expect, it, vi } from 'vitest';
import { BookAudioManager, type BookAudioDependencies } from '@/lib/bookAudioManager';
import type { TtsPart } from '@/lib/ttsChunkClient';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';

function deferred() {
  let resolve!: () => void; let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function setup(count = 6) {
  const parts: TtsPart[] = Array.from({ length: count }, (_, i) => ({ key: `key-${i}`, segmentId: 'segment',
    content: `Paragraph ${i}`, config: DEFAULT_TTS_CONFIG, configId: 'config', legacy: false,
    partIndex: i, partCount: count, segmentIndex: 0, segmentCount: 1 }));
  const requests = new Map<string, ReturnType<typeof deferred>>();
  const ended = new Map<string, ReturnType<typeof deferred>>();
  const cached = new Set<string>();
  const signals: AbortSignal[] = [];
  let active = 0; let maximum = 0;
  const deps = {
    settings: vi.fn<BookAudioDependencies['settings']>().mockResolvedValue(DEFAULT_TTS_CONFIG),
    plan: vi.fn<BookAudioDependencies['plan']>().mockResolvedValue(parts),
    ensure: vi.fn(async (part: TtsPart, signal: AbortSignal) => {
      if (cached.has(part.key)) return;
      signals.push(signal); active++; maximum = Math.max(maximum, active);
      const request = deferred(); requests.set(part.key, request);
      try { await request.promise; signal.throwIfAborted(); cached.add(part.key); } finally { active--; }
    }),
    read: vi.fn(async () => new Blob(['audio'])),
    play: vi.fn((part: TtsPart, _blob: Blob, signal: AbortSignal) => {
      const end = deferred(); ended.set(part.key, end);
      signal.addEventListener('abort', () => end.reject(signal.reason), { once: true });
      return end.promise;
    }),
    preload: vi.fn(), clearPreload: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(async () => {}),
  } satisfies BookAudioDependencies;
  const manager = new BookAudioManager(deps);
  const segments = [{ id: 'segment', content: 'content' }];
  return { manager, deps, parts, requests, ended, cached, signals, maximum: () => maximum, segments };
}

describe('book-scoped audio jobs', () => {
  it('starts first playback before other requests finish, preserves order, and bounds prefetch', async () => {
    const h = setup(); const run = h.manager.play(h.segments, 'book');
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.requests.get('key-1')!.resolve();
    await vi.waitFor(() => expect(h.requests.size).toBe(3));
    expect(h.deps.play).not.toHaveBeenCalled();
    h.requests.get('key-0')!.resolve();
    await vi.waitFor(() => expect(h.deps.play).toHaveBeenCalledOnce());
    expect(h.deps.play.mock.calls[0][0].key).toBe('key-0');
    expect(h.requests.size).toBe(3);
    h.ended.get('key-0')!.resolve();
    await vi.waitFor(() => expect(h.deps.play).toHaveBeenCalledTimes(2));
    expect(h.deps.play.mock.calls[1][0].key).toBe('key-1');
    expect(h.maximum()).toBe(2);
    h.manager.dispose(); await run;
  });

  it('stop prevents late autoplay but finishes and caches admitted generation', async () => {
    const h = setup(); const run = h.manager.play(h.segments, 'segment');
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.manager.stop();
    expect(h.signals.every(signal => !signal.aborted)).toBe(true);
    h.requests.get('key-0')!.resolve(); h.requests.get('key-1')!.resolve();
    await vi.waitFor(() => expect(h.requests.size).toBe(3));
    h.requests.get('key-2')!.resolve(); await run;
    await vi.waitFor(() => expect(h.cached.size).toBe(3));
    expect(h.deps.play).not.toHaveBeenCalled(); expect(h.requests.size).toBe(3);
    h.manager.dispose();
  });

  it('pause while preparing suppresses playback until resumed, then resumes between parts', async () => {
    const h = setup(2); const run = h.manager.play(h.segments, 'segment');
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.manager.pause(); h.requests.get('key-0')!.resolve(); h.requests.get('key-1')!.resolve();
    await vi.waitFor(() => expect(h.cached.size).toBe(2));
    expect(h.deps.play).not.toHaveBeenCalled();
    await h.manager.resume();
    await vi.waitFor(() => expect(h.deps.play).toHaveBeenCalledOnce());
    h.ended.get('key-0')!.resolve();
    await vi.waitFor(() => expect(h.deps.play).toHaveBeenCalledTimes(2));
    h.ended.get('key-1')!.resolve(); await run;
    expect(h.manager.getSnapshot().playback.state).toBe('idle'); h.manager.dispose();
  });

  it('whole-book generation fills beyond the prefetch window without autoplay', async () => {
    const h = setup(); const run = h.manager.generate(h.segments);
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    await h.manager.generate(h.segments); // duplicate start is ignored
    for (const part of h.parts) {
      await vi.waitFor(() => expect(h.requests.has(part.key)).toBe(true));
      h.requests.get(part.key)!.resolve();
    }
    await run;
    expect(h.manager.getSnapshot().generation).toMatchObject({ state: 'complete', completed: 6, total: 6 });
    expect(h.maximum()).toBe(2); expect(h.deps.play).not.toHaveBeenCalled();
    expect(h.deps.settings).toHaveBeenCalledOnce(); h.manager.dispose();
  });
  it('ignores a late resume failure after playback has stopped', async () => {
    const h = setup(1); const run = h.manager.play(h.segments, 'segment');
    await vi.waitFor(() => expect(h.requests.size).toBe(1));
    h.requests.get('key-0')!.resolve();
    await vi.waitFor(() => expect(h.deps.play).toHaveBeenCalledOnce());
    h.manager.pause();
    const resume = deferred(); h.deps.resume.mockReturnValueOnce(resume.promise);
    const resuming = h.manager.resume(); h.manager.stop();
    resume.reject(new Error('Old media was interrupted')); await resuming; await run;
    expect(h.manager.getSnapshot().playback.state).toBe('idle');
    h.manager.dispose();
  });

  it('pauses on first failure, finishes active work, and retries only missing chunks', async () => {
    const h = setup(4); const run = h.manager.generate(h.segments);
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.requests.get('key-0')!.reject(new Error('Trial exhausted'));
    await vi.waitFor(() => expect(h.manager.getSnapshot().generation.state).toBe('paused'));
    h.requests.get('key-1')!.resolve(); await run;
    expect(h.requests.size).toBe(2);
    expect(h.manager.getSnapshot().generation).toMatchObject({ completed: 1, error: 'Trial exhausted' });
    const failed = h.requests.get('key-0');
    const retry = h.manager.generate(h.segments);
    await vi.waitFor(() => expect(h.requests.get('key-0')).not.toBe(failed));
    for (const key of ['key-0', 'key-2', 'key-3']) {
      await vi.waitFor(() => expect(h.requests.has(key)).toBe(true)); h.requests.get(key)!.resolve();
    }
    await retry;
    expect(h.manager.getSnapshot().generation).toMatchObject({ state: 'complete', completed: 4 });
    expect(h.deps.settings).toHaveBeenCalledTimes(2); h.manager.dispose();
  });

  it('prioritizes playback ahead of bulk work and shares a request for the same chunk', async () => {
    const h = setup(); const bulk = h.manager.generate(h.segments);
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.deps.plan.mockResolvedValueOnce([h.parts[4], h.parts[5]]);
    const playback = h.manager.play(h.segments, 'segment');
    await vi.waitFor(() => expect(h.deps.plan).toHaveBeenCalledTimes(2));
    h.requests.get('key-0')!.resolve();
    await vi.waitFor(() => expect(h.requests.has('key-4')).toBe(true));
    expect(h.requests.has('key-2')).toBe(false);
    h.requests.get('key-4')!.resolve();
    await vi.waitFor(() => expect(h.deps.play).toHaveBeenCalledOnce());
    expect(h.deps.ensure.mock.calls.filter(([part]) => part.key === 'key-4')).toHaveLength(1);
    h.manager.dispose(); await Promise.all([bulk, playback]);
  });

  it('disposing the book aborts requests, drops queued work and ignores late results', async () => {
    const h = setup(); const bulk = h.manager.generate(h.segments);
    const playback = h.manager.play(h.segments, 'book');
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.manager.dispose();
    expect(h.signals.every(signal => signal.aborted)).toBe(true);
    h.requests.get('key-0')!.resolve(); h.requests.get('key-1')!.resolve();
    await Promise.all([bulk, playback]);
    expect(h.cached.size).toBe(0); expect(h.requests.size).toBe(2); expect(h.deps.play).not.toHaveBeenCalled();
  });

  it('uses a settings/content snapshot throughout a running job', async () => {
    const h = setup(2); const run = h.manager.generate(h.segments);
    await vi.waitFor(() => expect(h.requests.size).toBe(2));
    h.segments[0].content = 'Edited';
    h.deps.settings.mockResolvedValue({ ...DEFAULT_TTS_CONFIG, voice: 'new-voice' });
    h.requests.get('key-0')!.resolve(); h.requests.get('key-1')!.resolve(); await run;
    expect(h.deps.plan.mock.calls[0][0][0].content).toBe('content');
    expect(h.deps.settings).toHaveBeenCalledOnce();
    expect(h.deps.ensure.mock.calls.every(([part]) => part.config.voice === DEFAULT_TTS_CONFIG.voice)).toBe(true);
    h.manager.dispose();
  });
});
