/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TemplateCardGrid from './TemplateCardGrid';

const fetcher = vi.fn();
const push = vi.fn();

vi.mock('@/components/FetcherProvider', () => ({
  useFetcher: () => ({ fetcher }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  fetcher.mockReset();
  push.mockReset();
});

describe('TemplateCardGrid', () => {
  it('renders a keyboard-focusable edit overlay that targets the template edit page', async () => {
    fetcher
      .mockResolvedValueOnce([{
        templateId: 'forest-template',
        name: 'Forest adventure',
        promptBuilder: {},
        storyBackground: 'A quiet forest.',
        writingStyle: 'descriptive',
        imageUrl: null,
        ownerEmail: 'owner@example.com',
      }])
      .mockResolvedValueOnce([]);

    render(<TemplateCardGrid />);

    const editLink = await screen.findByRole('link', { name: 'Edit template' });
    expect(editLink.getAttribute('href')).toBe('/templates/forest-template');

    editLink.focus();
    expect(document.activeElement).toBe(editLink);
  });
});
