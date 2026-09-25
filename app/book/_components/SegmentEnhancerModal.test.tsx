/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import type { Template } from '@/types';

const mocks = vi.hoisted(() => ({ streamAiRequest: vi.fn(), showAlert: vi.fn() }));
vi.mock('@/lib/aiStreamClient', () => ({
  streamAiRequest: mocks.streamAiRequest,
  AiStreamError: class AiStreamError extends Error {},
}));
vi.mock('@/components/AlertBox', () => ({ useAlert: () => ({ showAlert: mocks.showAlert }) }));

import SegmentEnhancerModal from './SegmentEnhancerModal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.clearAllMocks();
});

describe('redo candidate enhancer prompt', () => {
  it('includes the candidate and earlier story while excluding the original assistant', async () => {
    mocks.streamAiRequest.mockResolvedValue('Enhanced');
    const template: Template = {
      templateId: 'template-1', name: 'Template', ownerEmail: 'owner@example.com',
      storyBackground: 'Background', writingStyle: 'Style', imageUrl: null,
      promptBuilder: {
        narration1: null, narration2: null, narrationSystem: null,
        enhancer: '{currentChapter}\n{selectedSegment}', enhancerSystem: null,
        segmentSummarizer: null, segmentSummarizerSystem: null,
        chapterSummarizer: null, chapterSummarizerSystem: null,
        outlineIdeaGenerator: null, outlineIdeaGeneratorSystem: null,
      },
    };
    render(<SegmentEnhancerModal
      template={template}
      book={{
        bookId: 'book-1', name: 'Book', templateId: 'template-1',
        storySegments: [
          { id: 'prior', role: 'assistant', day: 0, content: 'Earlier story' },
          { id: 'user-1', role: 'user', day: 0, content: 'Continue' },
          { id: 'assistant-1', role: 'assistant', day: 0, content: 'Original story' },
        ],
        chapters: [], segmentSummaries: [], longTermMemory: createEmptyLongTermMemoryState(),
      }}
      candidate={{
        id: 'candidate-1', userSegmentId: 'user-1', replacesSegmentId: 'assistant-1',
        versions: [{ content: 'Candidate story', narrationModel: null }],
        selectedContentIndex: 0, isLoading: false,
      }}
      candidateContentIndex={0}
      onClose={vi.fn()}
      onSaveCandidate={vi.fn()}
    />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'SEND' }));
    await waitFor(() => expect(mocks.streamAiRequest).toHaveBeenCalledTimes(1));
    const prompt = mocks.streamAiRequest.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Earlier story');
    expect(prompt).toContain('Candidate story');
    expect(prompt).not.toContain('Original story');
  });
});
