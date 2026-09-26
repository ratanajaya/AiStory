// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';
const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), ensure: vi.fn(), play: vi.fn(), stop: vi.fn(), alert: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/AlertBox', () => ({ useAlert: () => ({ showAlert: mocks.alert }) }));
vi.mock('@/lib/ttsAudioClient', () => ({ ensureSegmentAudioBlob: mocks.ensure, formatAudioTime: () => '0:00' }));
vi.mock('@/lib/ttsIndexedDb', () => ({ playAudioBlob: mocks.play, stopAudioPlayback: mocks.stop, pauseAudioPlayback: vi.fn(), resumeAudioPlayback: vi.fn(), subscribeToAudioPlayback: () => () => {} }));
import SegmentAudioControl from './SegmentAudioControl';
beforeEach(() => { vi.clearAllMocks(); mocks.fetcher.mockResolvedValue({ selectedTts: DEFAULT_TTS_CONFIG }); });
afterEach(cleanup);
describe('segment audio cancellation', () => {
  it.each(['settings', 'stop', 'unmount'])('prevents a late result starting after %s', async action => {
    let resolve!: (value: Blob) => void;
    mocks.ensure.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<SegmentAudioControl segmentId="segment" content="Hello" bookId="book" bookName="Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play segment audio' }));
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledOnce());
    expect(mocks.ensure.mock.calls[0][3]).toEqual(DEFAULT_TTS_CONFIG);
    const signal = mocks.ensure.mock.calls[0][4] as AbortSignal;
    if (action === 'unmount') view.unmount();
    else if (action === 'stop') fireEvent.click(screen.getByRole('button', { name: 'Stop segment audio' }));
    else act(() => { window.dispatchEvent(new Event('aistory:settings')); });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(new Blob(['late'])));
    expect(mocks.play).not.toHaveBeenCalled(); expect(mocks.alert).not.toHaveBeenCalled();
  });
});
