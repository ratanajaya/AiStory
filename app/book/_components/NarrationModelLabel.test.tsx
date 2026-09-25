/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SegmentCandidateDisplay from './SegmentCandidateDisplay';
import SegmentDisplay from './SegmentDisplay';
import ChapterDisplay from './ChapterDisplay';

vi.mock('./SegmentAudioControl', () => ({ default: () => <button>Audio</button> }));
vi.mock('./ChapterEditorModal', () => ({ default: () => null }));

afterEach(cleanup);

describe('narration model labels', () => {
  it('prominently shows the selected candidate version model', async () => {
    const candidate = {
      id: 'candidate-1', userSegmentId: 'user-1', selectedContentIndex: 0, isLoading: false,
      versions: [
        { content: 'First', narrationModel: { service: 'together' as const, model: 'first-model' } },
        { content: 'Second', narrationModel: { service: 'openAi' as const, model: 'second-model' } },
      ],
    };
    const onSelectContent = vi.fn();
    const props = {
      onSelectContent,
      onUpdateContent: vi.fn(), onTryAgain: vi.fn(), onEnhanceClick: vi.fn(),
      onAccept: vi.fn(), onReject: vi.fn(),
    };
    const { rerender } = render(<SegmentCandidateDisplay
      candidate={candidate}
      {...props}
    />);

    expect(screen.getByText('Narration model: Together AI · first-model')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Select candidate version 2' }));
    expect(onSelectContent).toHaveBeenCalledWith(1);
    rerender(<SegmentCandidateDisplay
      candidate={{ ...candidate, selectedContentIndex: 1 }}
      {...props}
    />);
    expect(screen.getByText('Narration model: OpenAI · second-model')).toBeTruthy();
  });

  it('shows a muted model label on regular and chapter segments, with no label for legacy segments', async () => {
    const segment = {
      id: 'assistant-1', day: 0, role: 'assistant', content: 'Story',
      narrationModel: { service: 'openAi' as const, model: 'gpt-model' },
    };
    const { rerender } = render(<SegmentDisplay
      index={1} segment={segment} bookId="book-1" bookName="Book"
      onUpdateSegment={vi.fn()} onDeleteSegment={vi.fn()} onEnhanceClick={vi.fn()}
      onWrapChapter={vi.fn()} onRedoNarration={vi.fn()}
    />);
    expect(screen.getByText('Narration model: OpenAI · gpt-model').className).toContain('text-xs');

    rerender(<ChapterDisplay
      chapter={{ id: 'chapter-1', title: 'Chapter', summary: '' }}
      segments={[segment]} bookId="book-1" bookName="Book" onChapterUpdate={vi.fn()}
    />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Chapter' }));
    expect(screen.getByText('Narration model: OpenAI · gpt-model').className).toContain('text-xs');
    rerender(<SegmentDisplay
      index={1} segment={{ id: 'legacy', day: 0, role: 'assistant', content: 'Old story' }}
      bookId="book-1" bookName="Book"
      onUpdateSegment={vi.fn()} onDeleteSegment={vi.fn()} onEnhanceClick={vi.fn()}
      onWrapChapter={vi.fn()} onRedoNarration={vi.fn()}
    />);
    expect(screen.queryByText(/Narration model:/)).toBeNull();
  });
});
