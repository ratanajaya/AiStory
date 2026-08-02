/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmPopover } from '@/components/ConfirmPopover';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ConfirmPopover', () => {
  it('cancels without invoking the action and restores trigger focus', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmPopover message="Delete this item?" onConfirm={onConfirm} confirmLabel="Yes" cancelLabel="No">
        <button type="button">Delete</button>
      </ConfirmPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Delete' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Confirmation' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'No' }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmation' })).toBeNull());

    await user.click(trigger);
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmation' })).toBeNull());
  });

  it('prevents duplicate confirmation while an async action is pending', async () => {
    const user = userEvent.setup();
    let resolveAction: (() => void) | undefined;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      resolveAction = resolve;
    }));
    render(
      <ConfirmPopover message="Delete this item?" onConfirm={onConfirm} confirmLabel="Yes">
        <button type="button">Delete</button>
      </ConfirmPopover>
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Working...' }).hasAttribute('disabled')).toBe(true);
    resolveAction?.();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmation' })).toBeNull());
  });

  it('stays open and reports a failed confirmation', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmPopover message="Delete this item?" onConfirm={() => Promise.reject(new Error('failed'))} confirmLabel="Yes">
        <button type="button">Delete</button>
      </ConfirmPopover>
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Unable to complete the action. Please try again.'
    );
    expect(screen.getByRole('dialog', { name: 'Confirmation' })).not.toBeNull();
  });
});
