/** @vitest-environment jsdom */

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '@/components/Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('Modal', () => {
  it('traps focus, locks scrolling, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open editor</button>
          <Modal
            title="Editor"
            open={open}
            onCancel={() => {
              onCancel();
              setOpen(false);
            }}
            onOk={() => undefined}
            okText="Save"
          >
            <input aria-label="Title" />
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open editor' });
    await user.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Editor' })).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editor' })).toBeNull());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
