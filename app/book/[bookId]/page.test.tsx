/** @vitest-environment jsdom */

import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import type { Book, Template } from '@/types';

const mocks = vi.hoisted(() => ({
  fetcher: vi.fn(),
  streamAiRequest: vi.fn(),
  showAlert: vi.fn(),
}));

vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/AlertBox', () => ({ useAlert: () => ({ showAlert: mocks.showAlert }) }));
vi.mock('@/lib/aiStreamClient', () => ({
  streamAiRequest: mocks.streamAiRequest,
  AiStreamError: class AiStreamError extends Error {},
}));
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: () => null,
}));
vi.mock('@/app/book/_components/useInputPanel', () => ({
  default: () => ({ element: null, getUserInput: () => ({ input1: 'New outline' }) }),
}));
vi.mock('@/app/book/_components/useDebugPanel', () => ({ default: () => ({ element: null }) }));
vi.mock('@/app/book/_components/SegmentDisplay', () => ({
  default: ({ segment, onRedoNarration, isLastMessage }: {
    segment: { id: string; content: string; role: string };
    onRedoNarration: (id: string) => void;
    isLastMessage: boolean;
  }) => <div data-testid={`segment-${segment.id}`}>
    {segment.content}
    {segment.role === 'assistant' && isLastMessage &&
      <button onClick={() => onRedoNarration(segment.id)}>Redo</button>}
  </div>,
}));
vi.mock('@/app/book/_components/SegmentCandidateDisplay', () => ({
  default: ({ candidate, onTryAgain, onAccept, onReject, onSelectContent, disabled }: {
    candidate: { versions: { content: string; narrationModel: { model: string } | null }[]; selectedContentIndex: number };
    onTryAgain: () => void;
    onAccept: () => void;
    onReject: () => void;
    onSelectContent: (index: number) => void;
    disabled: boolean;
  }) => <div data-testid="candidate">
    <span>{candidate.versions[candidate.selectedContentIndex]?.content}</span>
    <span>{candidate.versions[candidate.selectedContentIndex]?.narrationModel?.model}</span>
    {candidate.versions.map((_, index) =>
      <button key={index} onClick={() => onSelectContent(index)}>Version {index + 1}</button>)}
    <button onClick={onTryAgain} disabled={disabled}>Try Again</button>
    <button onClick={onAccept} disabled={disabled}>Accept</button>
    <button onClick={onReject} disabled={disabled}>Reject</button>
  </div>,
}));

vi.mock('@/app/book/_components/BookAudioControl', () => ({ default: () => null }));
vi.mock('@/app/book/_components/BookNameEditor', () => ({ default: () => null }));
vi.mock('@/app/book/_components/ChapterDisplay', () => ({ default: () => null }));
vi.mock('@/app/book/_components/StatusBar', () => ({ default: () => null }));
vi.mock('@/app/book/_components/SegmentEnhancerModal', () => ({ default: () => null }));
vi.mock('@/app/book/_components/SegmentSummarizerModal', () => ({ default: () => null }));
vi.mock('@/app/book/_components/ChapterWrapperModal', () => ({ default: () => null }));
vi.mock('@/app/book/_components/LongTermMemoryModal', () => ({ default: () => null }));

import BookPage from './page';

const book: Book = {
  bookId: 'book-1',
  name: 'Book',
  templateId: 'template-1',
  ownerEmail: 'owner@example.com',
  storySegments: [
    { id: 'prior', role: 'assistant', day: 0, content: 'Earlier story' },
    { id: 'user-1', role: 'user', day: 0, content: 'OUTLINE: Continue' },
    {
      id: 'assistant-1', role: 'assistant', day: 0, content: 'Original story',
      toSummarize: true,
      narrationModel: { service: 'openAi', model: 'old-model' },
    },
  ],
  segmentSummaries: [],
  chapters: [],
  longTermMemory: createEmptyLongTermMemoryState(),
};

const template = {
  templateId: 'template-1',
  name: 'Template',
  ownerEmail: 'owner@example.com',
  storyBackground: 'Background',
  writingStyle: 'Style',
  imageUrl: null,
  promptBuilder: {
    narration1: '{currentChapter}', narration2: '{textboxInput}', narrationSystem: 'System',
    enhancer: null, enhancerSystem: null, segmentSummarizer: null,
    segmentSummarizerSystem: null, chapterSummarizer: null,
    chapterSummarizerSystem: null, outlineIdeaGenerator: null,
    outlineIdeaGeneratorSystem: null,
  },
} satisfies Template;

async function openBook() {
  await act(async () => {
    render(<Suspense fallback={<div>Loading...</div>}><BookPage params={Promise.resolve({ bookId: 'book-1' })} /></Suspense>);
  });
  await screen.findByTestId('segment-assistant-1');
}

async function redo() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Redo' }));
  await screen.findByTestId('candidate');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(false));
}

describe('redo narration candidate lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetcher.mockImplementation(async (path: string) => {
      if (path === '/api/books/book-1') return book;
      if (path === '/api/templates/template-1/merged') return template;
      return {};
    });
    mocks.streamAiRequest.mockImplementation(async (_request, handlers) => {
      handlers.onModel({ service: 'together', model: 'new-model' });
      handlers.onChunk('Replacement story');
      return 'Replacement story';
    });
  });
  afterEach(cleanup);

  it('keeps both original segments on rejection and never sends a mutation', async () => {
    await openBook();
    await redo();
    expect(screen.getByTestId('segment-user-1').textContent).toContain('OUTLINE: Continue');
    expect(screen.getByTestId('segment-assistant-1').textContent).toContain('Original story');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.queryByTestId('candidate')).toBeNull());
    expect(screen.getByTestId('segment-assistant-1').textContent).toContain('Original story');
    expect(mocks.fetcher.mock.calls.filter(([path]) => path.includes('/segments'))).toHaveLength(0);
  });

  it('still removes a newly created user prompt when a fresh candidate is rejected', async () => {
    await openBook();
    await userEvent.setup().click(screen.getByRole('button', { name: 'SEND' }));
    await screen.findByTestId('candidate');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Reject' }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.queryByTestId('candidate')).toBeNull());
    expect(mocks.fetcher.mock.calls.some(([path, options]) =>
      path === '/api/books/book-1/segments' && options.method === 'POST')).toBe(true);
    expect(mocks.fetcher.mock.calls.some(([path, options]) =>
      path.startsWith('/api/books/book-1/segments/') && options.method === 'DELETE')).toBe(true);
    expect(screen.getByTestId('segment-assistant-1').textContent).toContain('Original story');
  });

  it('updates the original assistant with the selected text and model only on acceptance', async () => {
    await openBook();
    await redo();
    expect(mocks.fetcher.mock.calls.filter(([path]) => path.includes('/segments'))).toHaveLength(0);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(screen.queryByTestId('candidate')).toBeNull());
    const mutation = mocks.fetcher.mock.calls.find(([path]) => path.includes('/segments/'));
    expect(mutation?.[0]).toBe('/api/books/book-1/segments/assistant-1');
    expect(mutation?.[1].method).toBe('PATCH');
    expect(JSON.parse(mutation?.[1].body)).toMatchObject({
      id: 'assistant-1', content: 'Replacement story', toSummarize: true,
      narrationModel: { service: 'together', model: 'new-model' },
    });
    expect(screen.getByTestId('segment-assistant-1').textContent).toContain('Replacement story');
    expect(screen.getByTestId('segment-user-1')).toBeTruthy();
  });

  it('retains the original and candidate when saving fails', async () => {
    mocks.fetcher.mockImplementation(async (path: string) => {
      if (path === '/api/books/book-1') return book;
      if (path === '/api/templates/template-1/merged') return template;
      if (path.includes('/segments/')) throw new Error('Save failed');
      return {};
    });
    await openBook();
    await redo();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Accept' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('candidate')).toBeTruthy();
    expect(screen.getByTestId('segment-assistant-1').textContent).toContain('Original story');
  });

  it('retains the original pair if generation fails', async () => {
    mocks.streamAiRequest.mockRejectedValue(new Error('Generation failed'));
    await openBook();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() => expect(mocks.showAlert).toHaveBeenCalledWith('Generation failed', expect.any(Object)));
    expect(screen.queryByTestId('candidate')).toBeNull();
    expect(screen.getByTestId('segment-user-1')).toBeTruthy();
    expect(screen.getByTestId('segment-assistant-1').textContent).toContain('Original story');
  });

  it('keeps the old assistant out of both redo and retry prompts and tracks models per version', async () => {
    mocks.streamAiRequest
      .mockImplementationOnce(async (_request, handlers) => {
        handlers.onModel({ service: 'together', model: 'first-model' });
        return 'First candidate';
      })
      .mockImplementationOnce(async (_request, handlers) => {
        handlers.onModel({ service: 'openAi', model: 'second-model' });
        return 'Second candidate';
      });
    await openBook();
    await redo();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByText('second-model')).toBeTruthy());
    expect(mocks.streamAiRequest).toHaveBeenCalledTimes(2);
    for (const [request] of mocks.streamAiRequest.mock.calls) {
      expect(request.messages[0].content).toContain('Earlier story');
      expect(request.messages[0].content).not.toContain('Original story');
    }
    await userEvent.setup().click(screen.getByRole('button', { name: 'Version 1' }));
    expect(screen.getByText('first-model')).toBeTruthy();
  });
});
