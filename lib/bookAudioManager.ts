import type { TtsConfig } from '@/types';
import type { TtsPart, TtsSegment } from '@/lib/ttsChunkClient';

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export interface BookAudioSnapshot {
  playback: { state: PlaybackState; mode: 'book' | 'segment'; targetSegmentId?: string; part: TtsPart | null; error: string | null };
  generation: { state: 'idle' | 'generating' | 'paused' | 'complete'; completed: number; total: number; error: string | null };
}
export interface BookAudioDependencies {
  settings(signal: AbortSignal): Promise<TtsConfig>;
  plan(segments: TtsSegment[], config: TtsConfig, signal: AbortSignal): Promise<TtsPart[]>;
  ensure(part: TtsPart, signal: AbortSignal): Promise<void>;
  read(part: TtsPart): Promise<Blob>;
  /** Resolves when this part ends; rejects when interrupted or playback fails. */
  play(part: TtsPart, blob: Blob, signal: AbortSignal): Promise<void>;
  preload(part: TtsPart, blob: Blob): void;
  clearPreload(): void;
  stop(): void;
  pause(): void;
  resume(): Promise<void>;
}
interface Task {
  part: TtsPart; priority: number; running: boolean;
  promise: Promise<void>; resolve(): void; reject(error: unknown): void;
}
const aborted = () => new DOMException('Audio job ended', 'AbortError');
const message = (error: unknown) => error instanceof Error ? error.message : 'Audio generation failed.';

/** One instance per mounted book. Generation and playback have separate lifetimes. */
export class BookAudioManager {
  private lifetime = new AbortController();
  private intent: AbortController | null = null;
  private tasks = new Map<string, Task>();
  private active = 0;
  private listeners = new Set<() => void>();
  private generationId = 0;
  private generationKeys = new Set<string>();
  private paused = false;
  private wake: (() => void) | null = null;
  private snapshot: BookAudioSnapshot = {
    playback: { state: 'idle', mode: 'book', part: null, error: null },
    generation: { state: 'idle', completed: 0, total: 0, error: null },
  };
  constructor(private dependencies: BookAudioDependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private publish(update: Partial<BookAudioSnapshot>) {
    if (this.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach(listener => listener());
  }

  private request(part: TtsPart, priority: number): Promise<void> {
    if (this.lifetime.signal.aborted) return Promise.reject(aborted());
    const existing = this.tasks.get(part.key);
    if (existing) { existing.priority = Math.min(existing.priority, priority); return existing.promise; }
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    this.tasks.set(part.key, { part, priority, running: false, promise, resolve, reject });
    queueMicrotask(() => this.pump());
    return promise;
  }

  private pump() {
    if (this.lifetime.signal.aborted) return;
    while (this.active < 2) {
      const task = [...this.tasks.values()].filter(task => !task.running).sort((a, b) => a.priority - b.priority)[0];
      if (!task) return;
      task.running = true; this.active++;
      void this.dependencies.ensure(task.part, this.lifetime.signal).then(() => {
        this.lifetime.signal.throwIfAborted(); task.resolve();
      }).catch(error => {
        // Pause bulk scheduling before freeing the slot, so no extra request slips through.
        if (this.generationKeys.has(task.part.key) && this.snapshot.generation.state === 'generating') this.pauseGeneration(error);
        task.reject(error);
      }).finally(() => {
        if (this.tasks.get(task.part.key) === task) this.tasks.delete(task.part.key);
        this.active--; this.pump();
      });
    }
  }

  private pauseGeneration(error: unknown) {
    this.publish({ generation: { ...this.snapshot.generation, state: 'paused', error: message(error) } });
    for (const [key, task] of this.tasks) {
      if (!task.running && task.priority === 2) { this.tasks.delete(key); task.reject(aborted()); }
    }
  }

  async generate(segments: TtsSegment[]) {
    if (this.lifetime.signal.aborted || this.snapshot.generation.state === 'generating') return;
    const id = ++this.generationId;
    this.generationKeys.clear();
    const copied = segments.map(segment => ({ ...segment }));
    this.publish({ generation: { state: 'generating', completed: 0, total: 0, error: null } });
    try {
      const config = await this.dependencies.settings(this.lifetime.signal);
      const parts = await this.dependencies.plan(copied, config, this.lifetime.signal);
      if (this.lifetime.signal.aborted || id !== this.generationId || this.getSnapshot().generation.state !== 'generating') return;
      this.generationKeys = new Set(parts.map(part => part.key));
      this.publish({ generation: { ...this.snapshot.generation, total: parts.length } });
      const results = parts.map(part => this.request(part, 2).then(() => {
        if (this.lifetime.signal.aborted || id !== this.generationId) return;
        this.publish({ generation: { ...this.snapshot.generation, completed: this.snapshot.generation.completed + 1 } });
      }).catch(error => {
        if (id === this.generationId && this.snapshot.generation.state === 'generating' && !this.lifetime.signal.aborted) this.pauseGeneration(error);
      }));
      await Promise.all(results);
      if (id === this.generationId && this.getSnapshot().generation.state === 'generating') {
        this.publish({ generation: { ...this.snapshot.generation, state: 'complete' } });
      }
    } catch (error) {
      if (id === this.generationId && !this.lifetime.signal.aborted) this.pauseGeneration(error);
    }
  }

  async play(segments: TtsSegment[], mode: 'book' | 'segment') {
    if (this.lifetime.signal.aborted) return;
    this.stop();
    const intent = new AbortController(); this.intent = intent;
    const signal = intent.signal;
    const copied = segments.map(segment => ({ ...segment }));
    this.publish({ playback: { state: 'loading', mode, targetSegmentId: copied[0]?.id, part: null, error: null } });
    try {
      const config = await this.dependencies.settings(this.lifetime.signal);
      signal.throwIfAborted();
      const parts = await this.dependencies.plan(copied, config, this.lifetime.signal);
      signal.throwIfAborted();
      // Completed promises contain no blobs; cache reads happen only near playback.
      const admitted = new Map<number, Promise<{ error?: unknown }>>();
      for (let index = 0; index < parts.length; index++) {
        signal.throwIfAborted();
        const part = parts[index];
        this.publish({ playback: { state: this.paused ? 'paused' : 'loading', mode, part, error: null } });
        for (let next = index; next < Math.min(parts.length, index + 3); next++) {
          if (!admitted.has(next)) {
            admitted.set(next, this.request(parts[next], next === index ? 0 : 1)
              .then(() => ({})).catch(error => ({ error })));
          } else if (next === index) {
            const task = this.tasks.get(parts[next].key);
            if (task) task.priority = 0;
          }
        }
        const result = await admitted.get(index)!;
        signal.throwIfAborted();
        if (result.error) throw result.error;
        const blob = await this.dependencies.read(part);
        signal.throwIfAborted();
        // Keep only one prepared media element, and ignore results from an older part/run.
        const nextPart = parts[index + 1];
        if (nextPart) void admitted.get(index + 1)!.then(async result => {
          if (result.error || signal.aborted || this.snapshot.playback.part?.key !== part.key) return;
          const nextBlob = await this.dependencies.read(nextPart);
          if (!signal.aborted && this.snapshot.playback.part?.key === part.key) this.dependencies.preload(nextPart, nextBlob);
        }).catch(() => { /* The ordered playback loop reports cache/read failures. */ });
        if (this.paused) await new Promise<void>(resolve => { this.wake = resolve; });
        signal.throwIfAborted();
        this.publish({ playback: { ...this.snapshot.playback, state: 'playing' } });
        await this.dependencies.play(part, blob, signal);
        signal.throwIfAborted();
        admitted.delete(index);
      }
      if (this.intent === intent) this.stop();
    } catch (error) {
      if (!signal.aborted && !this.lifetime.signal.aborted) {
        this.dependencies.stop(); this.dependencies.clearPreload();
        this.publish({ playback: { ...this.snapshot.playback, state: 'error', error: message(error) } });
      }
    }
  }

  pause() {
    if (!this.intent || this.snapshot.playback.state === 'idle' || this.snapshot.playback.state === 'error') return;
    this.paused = true; this.dependencies.pause();
    this.publish({ playback: { ...this.snapshot.playback, state: 'paused' } });
  }
  async resume() {
    if (!this.paused) return;
    const intent = this.intent;
    this.paused = false;
    this.publish({ playback: { ...this.snapshot.playback, state: 'playing' } });
    this.wake?.(); this.wake = null;
    try { await this.dependencies.resume(); }
    catch (error) {
      if (this.intent !== intent || this.lifetime.signal.aborted) return;
      this.stop();
      this.publish({ playback: { ...this.snapshot.playback, state: 'error', error: message(error) } });
    }
  }
  stop() {
    this.intent?.abort(); this.intent = null;
    this.paused = false; this.wake?.(); this.wake = null;
    this.dependencies.stop(); this.dependencies.clearPreload();
    this.publish({ playback: { state: 'idle', mode: 'book', part: null, error: null } });
  }
  dispose() {
    this.stop(); this.lifetime.abort(); this.generationId++;
    for (const task of this.tasks.values()) task.reject(aborted());
    this.tasks.clear(); this.listeners.clear();
  }
}
