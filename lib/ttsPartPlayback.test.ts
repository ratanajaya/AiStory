import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';
import type { TtsPart } from '@/lib/ttsChunkClient';
import type { AudioPlaybackStatus } from '@/lib/ttsIndexedDb';

class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  src = ''; preload = ''; currentTime = 0; duration = 12; paused = true; ended = false;
  load = vi.fn();
  play = vi.fn(async () => { this.paused = false; this.dispatchEvent(new Event('playing')); });
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  removeAttribute() { this.src = ''; }
  constructor() { super(); TestAudio.instances.push(this); }
  end() { this.ended = true; this.dispatchEvent(new Event('ended')); }
}
const part = (key: string, partIndex = 0): TtsPart => ({ key, partIndex, partCount: 2, segmentIndex: 0, segmentCount: 1,
  segmentId: 's', content: key, configId: 'config', config: DEFAULT_TTS_CONFIG, legacy: false });
beforeEach(() => {
  vi.resetModules(); TestAudio.instances = [];
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('indexedDB', {}); vi.stubGlobal('Audio', TestAudio);
  let url = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++url}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('part playback and media preloading', () => {
  it('hands playback to the preloaded element, preserves pause position, and ignores old media events', async () => {
    const db = await import('@/lib/ttsIndexedDb');
    const { playTtsPart } = await import('@/lib/ttsPartPlayback');
    const states: AudioPlaybackStatus[] = [];
    const unsubscribe = db.subscribeToAudioPlayback(state => states.push(state));
    const blob = new Blob(['audio']); const signal = new AbortController().signal;
    const first = playTtsPart(part('one'), blob, signal);
    const audio = TestAudio.instances[0];
    audio.currentTime = 5;
    db.pauseAudioPlayback(); expect(states.at(-1)?.state).toBe('paused');
    await db.resumeAudioPlayback(); expect(audio.currentTime).toBe(5);
    db.preloadAudioBlob('two', blob);
    const next = TestAudio.instances[1]; expect(next.play).not.toHaveBeenCalled();
    audio.end(); await first;
    const second = playTtsPart(part('two', 1), blob, signal);
    expect(next.play).toHaveBeenCalledOnce(); expect(TestAudio.instances).toHaveLength(2);
    expect(states.at(-1)).toMatchObject({ chunkKey: 'two', partIndex: 1, state: 'playing' });
    audio.dispatchEvent(new Event('ended'));
    expect(states.at(-1)?.chunkKey).toBe('two');
    next.end(); await second;
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2); unsubscribe();
  });

  it('observes a short clip ending before the browser play promise resolves', async () => {
    const db = await import('@/lib/ttsIndexedDb');
    const { playTtsPart } = await import('@/lib/ttsPartPlayback');
    const blob = new Blob(['short']);
    db.preloadAudioBlob('short', blob);
    const audio = TestAudio.instances[0];
    audio.play.mockImplementation(async () => { audio.dispatchEvent(new Event('playing')); audio.end(); });
    await expect(playTtsPart(part('short'), blob, new AbortController().signal)).resolves.toBeUndefined();
  });

  it('removes the part subscription on abort and releases prepared audio on cleanup', async () => {
    const db = await import('@/lib/ttsIndexedDb');
    const { playTtsPart } = await import('@/lib/ttsPartPlayback');
    const controller = new AbortController(); const blob = new Blob(['audio']);
    const playing = playTtsPart(part('one'), blob, controller.signal);
    db.preloadAudioBlob('two', blob);
    controller.abort(); db.stopAudioPlayback(); db.clearPreloadedAudio();
    await expect(playing).rejects.toMatchObject({ name: 'AbortError' });
    expect(TestAudio.instances.every(audio => audio.src === '')).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
