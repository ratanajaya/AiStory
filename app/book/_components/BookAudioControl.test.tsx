// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';
import { splitTtsText } from '@/lib/ttsChunks';
import type { StorySegment, TtsConfig } from '@/types';
import type { AudioPlaybackStatus } from '@/lib/ttsIndexedDb';
import type { TtsPart, TtsSegment } from '@/lib/ttsChunkClient';

const mocks = vi.hoisted(() => ({
  fetcher: vi.fn(), ensure: vi.fn(), plan: vi.fn(), read: vi.fn(), play: vi.fn(), stop: vi.fn(), preload: vi.fn(),
  listeners: new Set<(status: AudioPlaybackStatus) => void>(),
  status: { activeSegmentId: null, state: 'idle', currentTime: 0, duration: 0, errorMessage: null } as AudioPlaybackStatus,
  hidden: false,
}));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/UiStateProvider', () => ({ useUiState: () => ({ uiState: { bookAudioHidden: mocks.hidden }, setBookAudioHidden: vi.fn() }) }));
vi.mock('@/app/_components/TrialActionNotice', () => ({ default: () => null }));
vi.mock('@/lib/ttsChunkClient', () => ({ ensureTtsPart: mocks.ensure, planTtsParts: mocks.plan, readTtsPart: mocks.read }));
vi.mock('@/lib/ttsIndexedDb', () => ({
  playAudioBlob: mocks.play, stopAudioPlayback: mocks.stop, pauseAudioPlayback: vi.fn(), resumeAudioPlayback: vi.fn(),
  preloadAudioBlob: mocks.preload, clearPreloadedAudio: vi.fn(),
  subscribeToAudioPlayback: (listener: (status: AudioPlaybackStatus) => void) => {
    mocks.listeners.add(listener); listener(mocks.status); return () => mocks.listeners.delete(listener);
  },
}));
import { BookAudioProvider } from '@/app/book/_components/BookAudioProvider';
import BookAudioControl from '@/app/book/_components/BookAudioControl';
import SegmentAudioControl from '@/app/book/_components/SegmentAudioControl';

function emit(status: Partial<AudioPlaybackStatus>) {
  mocks.status = { ...mocks.status, ...status };
  mocks.listeners.forEach(listener => listener(mocks.status));
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners.clear(); mocks.hidden = false;
  mocks.status = { activeSegmentId: null, state: 'idle', currentTime: 0, duration: 0, errorMessage: null };
  mocks.fetcher.mockResolvedValue({ selectedTts: DEFAULT_TTS_CONFIG });
  mocks.plan.mockImplementation(async (segments: TtsSegment[], config: TtsConfig) => segments.flatMap((segment, segmentIndex) => {
    const chunks = splitTtsText(segment.content);
    return chunks.map((content, partIndex): TtsPart => ({ key: `${segment.id}-${partIndex}`, content, segmentId: segment.id,
      config, configId: 'config', legacy: false, partIndex, partCount: chunks.length, segmentIndex, segmentCount: segments.length }));
  }));
  mocks.ensure.mockResolvedValue(undefined); mocks.read.mockResolvedValue(new Blob(['audio']));
  mocks.play.mockImplementation(async (id: string, _blob: Blob, part: Partial<AudioPlaybackStatus>) => emit({ ...part, activeSegmentId: id, state: 'playing' }));
  mocks.stop.mockImplementation(() => emit({ activeSegmentId: null, chunkKey: undefined, state: 'idle' }));
});
afterEach(cleanup);
const segments = [{ id: 'first', role: 'assistant', content: 'First.\n\nSecond.' }, { id: 'second', role: 'assistant', content: 'Third.' }] as StorySegment[];
const view = (bookId = 'book') => <BookAudioProvider key={bookId} bookId={bookId}>
  <BookAudioControl segments={segments} chapters={[]} bookId={bookId} bookName="Book" />
  <SegmentAudioControl segmentId="first" content={segments[0].content} bookId={bookId} bookName="Book" />
</BookAudioProvider>;

describe('book audio UI and lifetime', () => {
  it('prepares the whole book without autoplay and reports completion', async () => {
    render(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Generate book audio' }));
    await screen.findByText('3/3 parts · Complete');
    expect(mocks.ensure).toHaveBeenCalledTimes(3); expect(mocks.play).not.toHaveBeenCalled();
  });
  it('starts playback part by part and shows part progress', async () => {
    render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Play book audio' }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    expect(screen.getAllByText(/Part 1\/2/).length).toBeGreaterThan(0);
    act(() => emit({ activeSegmentId: null, chunkKey: undefined, state: 'idle' }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledTimes(2));
    expect(mocks.play.mock.calls[1][2]).toMatchObject({ partIndex: 1, partCount: 2 });
    act(() => emit({ activeSegmentId: null, chunkKey: undefined, state: 'idle' }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledTimes(3));
    expect(mocks.play.mock.calls[2][0]).toBe('second');
  });
  it('keeps generation alive on settings changes and stopping playback, without late autoplay', async () => {
    const complete: (() => void)[] = [];
    mocks.ensure.mockImplementation(() => new Promise<void>(resolve => { complete.push(resolve); }));
    render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Play segment audio' }));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(2));
    const signal = mocks.ensure.mock.calls[0][2] as AbortSignal;
    act(() => window.dispatchEvent(new Event('aistory:settings')));
    expect(signal.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop segment audio' }));
    expect(signal.aborted).toBe(false);
    await act(async () => complete.forEach(done => done())); expect(mocks.play).not.toHaveBeenCalled();
  });
  it.each(['leave', 'another-book', 'actor'])('kills generation on %s and rejects late playback', async action => {
    const complete: (() => void)[] = [];
    mocks.ensure.mockImplementation(() => new Promise<void>(resolve => { complete.push(resolve); }));
    const rendered = render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Play book audio' }));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(2));
    const signals = mocks.ensure.mock.calls.map(call => call[2] as AbortSignal);
    if (action === 'leave') rendered.unmount();
    else if (action === 'another-book') rendered.rerender(view('other'));
    else act(() => window.dispatchEvent(new Event('aistory:actor')));
    expect(signals.every(signal => signal.aborted)).toBe(true);
    await act(async () => complete.forEach(done => done()));
    expect(mocks.play).not.toHaveBeenCalled(); expect(mocks.ensure).toHaveBeenCalledTimes(2);
  });
  it('renders retry after a failure and uses current settings on retry', async () => {
    mocks.ensure.mockRejectedValueOnce(new Error('Trial exhausted'));
    render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Generate book audio' }));
    await screen.findByText('Trial exhausted');
    mocks.fetcher.mockResolvedValue({ selectedTts: { ...DEFAULT_TTS_CONFIG, voice: 'af_heart' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry generation' }));
    await screen.findByText('3/3 parts · Complete');
    expect(mocks.plan.mock.calls.at(-1)?.[1].voice).toBe('af_heart');
  });
  it('does not kill jobs when the book view merely rerenders', async () => {
    mocks.ensure.mockReturnValue(new Promise(() => {}));
    const rendered = render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Generate book audio' }));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(2));
    const signal = mocks.ensure.mock.calls[0][2] as AbortSignal;
    rendered.rerender(view());
    expect(signal.aborted).toBe(false); expect(mocks.fetcher).toHaveBeenCalledOnce();
  });
  it('keeps whole-book preparation running while the panel is hidden', async () => {
    const complete: (() => void)[] = [];
    mocks.ensure.mockImplementation(() => new Promise<void>(resolve => { complete.push(resolve); }));
    const rendered = render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Generate book audio' }));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(2));
    const signal = mocks.ensure.mock.calls[0][2] as AbortSignal;
    mocks.hidden = true; rendered.rerender(view());
    expect(screen.queryByRole('button', { name: 'Generate book audio' })).toBeNull();
    await act(async () => complete.splice(0).forEach(done => done()));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(3));
    await act(async () => complete.forEach(done => done()));
    expect(signal.aborted).toBe(false); expect(mocks.play).not.toHaveBeenCalled();
    mocks.hidden = false; rendered.rerender(view());
    await screen.findByText('3/3 parts · Complete');
  });
});
