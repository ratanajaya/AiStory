/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LongTermMemoryModal from './LongTermMemoryModal';
import type { LongTermMemoryState } from '@/types';

const fetcher = vi.fn();
vi.mock('@/components/FetcherProvider', () => ({
  useFetcher: () => ({ fetcher }),
}));

const memory: LongTermMemoryState = {
  content: {
    schemaVersion: 1,
    entries: {
      clue: { category: 'continuity', title: 'Clue', attributes: { status: 'open' } },
    },
  },
  revision: 3,
  checkpoint: { throughSegmentId: 'a1', fingerprint: 'hash-1' },
  updatedAt: '2026-08-18T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

beforeEach(() => fetcher.mockReset());

describe('LongTermMemoryModal', () => {
  it('validates and formats manual JSON before saving', async () => {
    render(
      <LongTermMemoryModal open bookId="book-1" memory={memory} onClose={vi.fn()} onMemoryChange={vi.fn()} />
    );

    const editor = await screen.findByLabelText('Long-term memory JSON');
    fireEvent.change(editor, { target: { value: '{bad json' } });
    expect(screen.getByRole('button', { name: 'Save memory' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/Expected property name/)).not.toBeNull();
  });

  it('shows removals, validates edited patches, and rejects without persistence', async () => {
    const user = userEvent.setup();
    fetcher.mockResolvedValue({
      baseRevision: 3,
      operations: [{ op: 'remove', path: '/entries/clue' }],
      source: {
        mode: 'incremental',
        previousThroughSegmentId: 'a1',
        throughSegmentId: 'a2',
        fingerprint: 'hash-2',
      },
    });
    render(
      <LongTermMemoryModal open bookId="book-1" memory={memory} onClose={vi.fn()} onMemoryChange={vi.fn()} />
    );

    await user.click(await screen.findByRole('button', { name: 'Update from new content' }));
    expect(await screen.findByText('remove')).not.toBeNull();
    expect(screen.getByText('/entries/clue')).not.toBeNull();

    const patchEditor = screen.getByLabelText('Long-term memory JSON Patch');
    fireEvent.change(patchEditor, { target: { value: '[{"op":"remove","path":"/schemaVersion"}]' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept proposal' })).toHaveProperty('disabled', true));

    await user.click(screen.getByRole('button', { name: 'Reject proposal' }));
    expect(await screen.findByText('Proposal rejected; memory was not changed.')).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

});
