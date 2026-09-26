// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';
import type { StorySegment } from '@/types';
import type { AudioPlaybackStatus } from '@/lib/ttsIndexedDb';

const mocks = vi.hoisted(() => ({
  fetcher: vi.fn(), ensure: vi.fn(), play: vi.fn(), stop: vi.fn(), alert: vi.fn(),
  listeners: new Set<(status: AudioPlaybackStatus) => void>(),
  status: { activeSegmentId: null, state: 'idle', currentTime: 0, duration: 0, errorMessage: null } as AudioPlaybackStatus,
}));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/AlertBox', () => ({ useAlert: () => ({ showAlert: mocks.alert }) }));
vi.mock('@/components/UiStateProvider', () => ({ useUiState: () => ({ uiState: { bookAudioHidden: false }, setBookAudioHidden: vi.fn() }) }));
vi.mock('@/app/_components/TrialActionNotice', () => ({ default: () => null }));
vi.mock('@/lib/ttsAudioClient', () => ({ ensureSegmentAudioBlob: mocks.ensure, formatAudioTime: () => '0:00' }));
vi.mock('@/lib/ttsIndexedDb', () => ({
  playAudioBlob: mocks.play, stopAudioPlayback: mocks.stop, pauseAudioPlayback: vi.fn(), resumeAudioPlayback: vi.fn(),
  subscribeToAudioPlayback: (listener: (status: AudioPlaybackStatus) => void) => { mocks.listeners.add(listener); listener(mocks.status); return () => mocks.listeners.delete(listener); },
}));
import BookAudioControl from './BookAudioControl';
function emit(activeSegmentId: string | null, state: AudioPlaybackStatus['state']) {
  mocks.status = { ...mocks.status, activeSegmentId, state };
  mocks.listeners.forEach(listener => listener(mocks.status));
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners.clear(); emit(null, 'idle');
  mocks.fetcher.mockResolvedValue({ selectedTts: DEFAULT_TTS_CONFIG });
  mocks.play.mockImplementation(async (id: string) => { emit(id, 'playing'); });
  mocks.stop.mockImplementation(() => { emit(null, 'idle'); });
});
afterEach(cleanup);
const segments = [{ id: 'first', role: 'assistant', content: 'First.' }, { id: 'second', role: 'assistant', content: 'Second.' }] as StorySegment[];

describe('book audio queue', () => {
  it('snapshots settings once and discards a prefetched segment after settings change', async () => {
    let resolve!: (value: Blob) => void;
    mocks.ensure.mockResolvedValueOnce(new Blob(['first'])).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(<BookAudioControl segments={segments} chapters={[]} bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play book audio' }));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(2));
    expect(mocks.fetcher).toHaveBeenCalledOnce();
    expect(mocks.ensure.mock.calls.every(call => call[3] === DEFAULT_TTS_CONFIG)).toBe(true);
    const signal = mocks.ensure.mock.calls[1][4] as AbortSignal;
    act(() => { window.dispatchEvent(new Event('aistory:settings')); });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(new Blob(['late'])));
    expect(mocks.play).toHaveBeenCalledOnce(); expect(mocks.alert).not.toHaveBeenCalled();
  });
  it('handles audio completing before the queue subscribes without leaking a listener', async () => {
    mocks.ensure.mockResolvedValue(new Blob(['audio']));
    mocks.play.mockImplementation(async () => { emit(null, 'idle'); });
    render(<BookAudioControl segments={segments} chapters={[]} bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play book audio' }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledTimes(2));
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.listeners.size).toBe(1);
  });
});
