/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '@/components/Tooltip';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Tooltip', () => {
  it('opens for hover and focus, links the trigger, and closes with Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content={<strong>Helpful detail</strong>}>
        <button type="button">Info</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'Info' });
    await user.hover(trigger);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Helpful detail');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    trigger.focus();
    expect(await screen.findByRole('tooltip')).not.toBeNull();
  });

  it('clamps a positioned overlay within the viewport', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 120 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'tooltip') {
        return new DOMRect(0, 0, 160, 40);
      }
      return new DOMRect(180, 90, 20, 20);
    });

    render(
      <Tooltip content="Edge tooltip">
        <button type="button">Edge</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole('button', { name: 'Edge' }));

    const tooltip = await screen.findByRole('tooltip');
    await waitFor(() => expect(tooltip.style.visibility).toBe('visible'));
    expect(Number.parseFloat(tooltip.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(tooltip.style.left)).toBeLessThanOrEqual(32);
    expect(Number.parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(tooltip.style.top)).toBeLessThanOrEqual(72);
  });
});
