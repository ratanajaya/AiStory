/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const fetcher = vi.fn();
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher }) }));
import ReleasedBookGrid from '@/app/_components/ReleasedBookGrid';
afterEach(() => { cleanup(); fetcher.mockReset(); });
it('renders release metadata and links to the separate viewer', async () => {
  fetcher.mockResolvedValue([{ releaseId: 'r', title: 'Story', releasedAt: '2026-10-07', segmentCount: 3, audioParts: 2, expectedAudioParts: 4 }]);
  render(<ReleasedBookGrid />);
  expect((await screen.findByRole('link', { name: 'Story' })).getAttribute('href')).toBe('/released-books/r');
  expect(screen.getByText('3 segments; 2/4 audio parts')).toBeTruthy();
});
it('handles visitors with an empty released library', async () => {
  fetcher.mockRejectedValue({ statusCode: 401 }); render(<ReleasedBookGrid />);
  expect(await screen.findByText('Release a book from its editor to read it here.')).toBeTruthy();
});
