// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG, TTS_PREVIEW_TEXT } from '@/lib/ttsConfig';
const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), audio: vi.fn(), play: vi.fn(), stop: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/lib/ttsAudioClient', () => ({ requestTtsAudio: mocks.audio }));
vi.mock('@/lib/ttsIndexedDb', () => ({ playAudioBlob: mocks.play, stopAudioPlayback: mocks.stop, subscribeToAudioPlayback: () => () => {} }));
import { TtsSettingsSection } from './TtsSettingsSection';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetcher.mockImplementation(async (url: string) => url.includes('/models/') ? { models: url.includes('openai')
    ? [{ id: 'tts-1', label: 'TTS 1', defaultVoice: 'alloy', voices: [{ id: 'alloy', label: 'Alloy' }, { id: 'nova', label: 'Nova' }] }]
    : [{ id: DEFAULT_TTS_CONFIG.model, label: 'Kokoro', defaultVoice: 'af_nicole', voices: [{ id: 'af_nicole', label: 'Nicole' }] }]
  } : { selectedTts: DEFAULT_TTS_CONFIG });
  mocks.audio.mockResolvedValue({ audioBlob: new Blob(['audio']) }); mocks.play.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('TTS settings UI', () => {
  it('loads the catalog, resets incompatible choices, previews without saving, then saves narrowly', async () => {
    render(<TtsSettingsSection actorKind="guest" />);
    await waitFor(() => expect((screen.getByText('Test voice') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Speech provider'), { target: { value: 'openAi' } });
    await screen.findByText('TTS 1');
    expect((screen.getByText('Test voice') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Speech model'), { target: { value: 'tts-1' } });
    expect((screen.getByLabelText('Voice') as HTMLSelectElement).value).toBe('alloy');
    fireEvent.change(screen.getByLabelText('Voice'), { target: { value: 'nova' } });
    fireEvent.click(screen.getByText('Test voice'));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    const config = { service: 'openAi', model: 'tts-1', voice: 'nova' };
    expect(mocks.audio).toHaveBeenCalledWith(TTS_PREVIEW_TEXT, config, expect.objectContaining({ scope: 'actor' }));
    expect(mocks.fetcher.mock.calls.every(call => call[1]?.method !== 'PUT')).toBe(true);
    fireEvent.click(screen.getByText('Save voice'));
    await screen.findByText('Voice settings saved.');
    expect(mocks.fetcher).toHaveBeenCalledWith('/api/guest/settings', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ selectedTts: config }) }));
  });
  it('keeps unavailable selections and supports retry after a catalog error', async () => {
    mocks.fetcher.mockRejectedValueOnce(new Error('Catalog unavailable'));
    render(<TtsSettingsSection scope="defaults" value={DEFAULT_TTS_CONFIG} onChange={() => {}} />);
    await screen.findByText('Catalog unavailable');
    expect((screen.getByText('Test voice') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Speech model') as HTMLSelectElement).value).toBe(DEFAULT_TTS_CONFIG.model);
    fireEvent.click(screen.getByText('Reload models'));
    await waitFor(() => expect((screen.getByText('Test voice') as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.fetcher).toHaveBeenCalledWith('/api/ai/tts/models/together?scope=defaults', expect.any(Object));
  });
  it('aborts a pending preview on close and never plays its late result', async () => {
    let resolve!: (value: { audioBlob: Blob }) => void;
    mocks.audio.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<TtsSettingsSection />);
    await waitFor(() => expect((screen.getByText('Test voice') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText('Test voice'));
    const signal = mocks.audio.mock.calls[0][2].signal as AbortSignal;
    view.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => resolve({ audioBlob: new Blob(['late']) }));
    expect(mocks.play).not.toHaveBeenCalled(); expect(mocks.stop).toHaveBeenCalledWith('tts-preview');
  });
  it('requires saving edited keys before testing', async () => {
    render(<TtsSettingsSection credentialsDirty />);
    await screen.findByText('Kokoro');
    expect((screen.getByText('Test voice') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Save your API key changes before testing a voice.')).toBeTruthy();
  });
});
