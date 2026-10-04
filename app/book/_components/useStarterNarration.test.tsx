/** @vitest-environment jsdom */
import { StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Book, Template } from '@/types';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';

const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), stream: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/lib/aiStreamClient', () => ({ streamAiRequest: mocks.stream, AiStreamError: class extends Error {} }));
import useStarterNarration from './useStarterNarration';

const book: Book = { bookId: 'b1', templateId: 't1', name: null,
  storySegments: [{ id: '100', day: 0, role: 'user', content: 'Meet Mara.\nA storm arrives.' }],
  segmentSummaries: [], chapters: [], longTermMemory: createEmptyLongTermMemoryState() };
const template: Template = { templateId: 't1', name: 'Template', storyBackground: 'Background', writingStyle: 'Style', imageUrl: null,
  promptBuilder: { narration1: '{currentChapter}', narration2: '{textboxInput}', narrationSystem: 'System', enhancer: null, enhancerSystem: null,
    segmentSummarizer: null, segmentSummarizerSystem: null, chapterSummarizer: null, chapterSummarizerSystem: null,
    outlineIdeaGenerator: null, outlineIdeaGeneratorSystem: null } };
function open(overrides: Partial<Parameters<typeof useStarterNarration>[0]> = {}) {
  const onSaved = vi.fn();
  const options = { ready: true, book, template, onSaved, onStatusChange: vi.fn(), ...overrides };
  return { ...renderHook((props) => useStarterNarration(props), { initialProps: options, wrapper: StrictMode }), onSaved, options };
}
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/book/b1?starterSegmentId=100');
  mocks.fetcher.mockResolvedValue({});
  mocks.stream.mockImplementation(async (_req, handlers) => {
    handlers.onModel({ service: 'together', model: 'narrator' });
    handlers.onChunk('A storm');
    return 'A storm arrives.';
  });
});
afterEach(cleanup);

it('generates once in StrictMode and automatically saves with metadata', async () => {
  const { result, onSaved, rerender, options } = open();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(mocks.stream).toHaveBeenCalledTimes(1);
  expect(mocks.stream.mock.calls[0][0].messages[0].content).toContain(book.storySegments[0].content);
  const segment = JSON.parse(mocks.fetcher.mock.calls[0][1].body).segment;
  expect(segment).toMatchObject({ role: 'assistant', day: 0, content: 'A storm arrives.', narrationModel: { service: 'together', model: 'narrator' } });
  expect(result.current.pending).toBe(false);
  expect(window.location.search).toBe('');
  rerender({ ...options });
  expect(mocks.stream).toHaveBeenCalledTimes(1);
});
it('waits for both book and template loading', async () => {
  const { rerender, options, onSaved } = open({ ready: false });
  expect(mocks.stream).not.toHaveBeenCalled();
  rerender({ ...options, ready: true });
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
});
it.each(['', '?starterSegmentId=other'])('does not generate without a valid start handoff %s', query => {
  window.history.replaceState(null, '', '/book/b1' + query);
  open();
  expect(mocks.stream).not.toHaveBeenCalled();
});
it('does not generate for an existing book', () => {
  open({ book: { ...book, storySegments: [...book.storySegments, { id: '200', day: 0, role: 'assistant', content: 'Saved' }] } });
  expect(mocks.stream).not.toHaveBeenCalled();
});
it('keeps partial output unsaved on generation failure and retries the same outline', async () => {
  mocks.stream.mockImplementationOnce(async (_req, handlers) => { handlers.onChunk('Partial'); throw new Error('Provider failed'); });
  const { result, onSaved } = open();
  await waitFor(() => expect(result.current.error).toBe('Provider failed'));
  expect(result.current.preview?.content).toBe('Partial');
  expect(mocks.fetcher).not.toHaveBeenCalled();
  await act(() => result.current.retry());
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(mocks.stream).toHaveBeenCalledTimes(2);
});
it('does not save an empty successful response', async () => {
  mocks.stream.mockResolvedValue('  ');
  const { result } = open();
  await waitFor(() => expect(result.current.error).toContain('empty'));
  expect(mocks.fetcher).not.toHaveBeenCalled();
});
it('retries saving the same completed segment without another generation', async () => {
  mocks.fetcher.mockImplementation(async (path: string) => {
    if (path.endsWith('/segments')) throw new Error('Save failed');
    return book;
  });
  const { result, onSaved } = open();
  await waitFor(() => expect(result.current.canSave).toBe(true));
  const firstBody = mocks.fetcher.mock.calls[0][1].body;
  mocks.fetcher.mockResolvedValue({});
  await act(() => result.current.retry());
  expect(mocks.stream).toHaveBeenCalledTimes(1);
  expect(mocks.fetcher.mock.calls[2][1].body).toBe(firstBody);
  expect(onSaved).toHaveBeenCalledTimes(1);
});
it('reconciles a lost save response against the stored assistant', async () => {
  mocks.fetcher.mockImplementation(async (path: string) => {
    if (path.endsWith('/segments')) throw new Error('Segment already exists');
    const segment = JSON.parse(mocks.fetcher.mock.calls[0][1].body).segment;
    return { ...book, storySegments: [...book.storySegments, segment] };
  });
  const { onSaved } = open();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(mocks.stream).toHaveBeenCalledTimes(1);
});
