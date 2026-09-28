// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendAiApiLog, clearAiApiLogs } from '@/lib/aiApiLog';
const mocks = vi.hoisted(() => ({ chunk: vi.fn(), segment: vi.fn(), play: vi.fn() }));
vi.mock('@/lib/ttsIndexedDb', () => ({ getChunkAudio: mocks.chunk, getSegmentAudio: mocks.segment, playAudioBlob: mocks.play }));
import { AiApiLogDrawer } from '@/app/_components/AiApiLogDrawer';
beforeEach(() => { vi.clearAllMocks(); clearAiApiLogs(); });
afterEach(cleanup);

describe('cached TTS log replay', () => {
  it.each([false, true])('replays a matching recording (chunk: %s)', async chunk => {
    const blob = new Blob(['audio']); const record = { segmentId: 's', content: 'Hello', configId: 'config', audioBlob: blob };
    mocks.chunk.mockResolvedValue(record); mocks.segment.mockResolvedValue(record);
    appendAiApiLog({ feature: 'Narration', kind: 'tts', status: 'success', durationMs: 1, payload: { input: 'Hello' },
      audio: { segmentId: 's', configId: 'config', mimeType: 'audio/wav', byteSize: blob.size,
        ...(chunk ? { cacheKey: 'chunk-key', partIndex: 1, partCount: 3 } : {}) } });
    render(<AiApiLogDrawer isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Narration')); fireEvent.click(screen.getByText('Play cached audio'));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledWith('s', blob));
    if (chunk) { expect(mocks.chunk).toHaveBeenCalledWith('chunk-key'); await screen.findByText(/Part 2\/3/); }
    else expect(mocks.segment).toHaveBeenCalledWith('s');
  });
  it.each(['content', 'configId'])('rejects a stale recording with mismatching %s', async field => {
    mocks.segment.mockResolvedValue({ segmentId: 's', content: 'Hello', configId: 'config', [field]: 'changed' });
    appendAiApiLog({ feature: 'Narration', kind: 'tts', status: 'success', durationMs: 1, payload: { input: 'Hello' },
      audio: { segmentId: 's', configId: 'config', mimeType: 'audio/wav', byteSize: 1 } });
    render(<AiApiLogDrawer isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Narration')); fireEvent.click(screen.getByText('Play cached audio'));
    await screen.findByText('The audio cache for this log is no longer available.');
    expect(mocks.play).not.toHaveBeenCalled();
  });
});
