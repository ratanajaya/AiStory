/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChapterEditorModal from '@/app/book/_components/ChapterEditorModal';
import type { Chapter } from '@/types';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('ChapterEditorModal', () => {
  const chapter: Chapter = { id: 'chapter-1', title: 'Opening', summary: 'Original summary' };

  it('blocks a blank title and saves valid controlled values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ChapterEditorModal isOpen chapter={chapter} onSave={onSave} onClose={onClose} />
    );

    const title = await screen.findByLabelText(/Title/);
    await user.clear(title);
    await user.type(title, '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert').textContent).toBe('Please input the title of the chapter');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(title);

    await user.clear(title);
    await user.type(title, 'A New Beginning');
    const summary = screen.getByLabelText('Summary');
    await user.clear(summary);
    await user.type(summary, 'Updated summary');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      id: 'chapter-1',
      title: 'A New Beginning',
      summary: 'Updated summary',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('resets fields when a different chapter is opened', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <ChapterEditorModal isOpen chapter={chapter} onSave={onSave} onClose={onClose} />
    );
    expect(await screen.findByLabelText(/Title/)).toHaveProperty('value', 'Opening');

    const nextChapter: Chapter = { id: 'chapter-2', title: 'Finale', summary: 'The ending' };
    rerender(<ChapterEditorModal isOpen chapter={nextChapter} onSave={onSave} onClose={onClose} />);

    await waitFor(() => expect(screen.getByLabelText(/Title/)).toHaveProperty('value', 'Finale'));
    expect(screen.getByLabelText('Summary')).toHaveProperty('value', 'The ending');
  });
});
