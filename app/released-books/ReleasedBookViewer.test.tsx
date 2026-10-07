/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), play: vi.fn(), pause: vi.fn(), load: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
import ReleasedBookViewer from '@/app/released-books/ReleasedBookViewer';
const book = { title: 'Story', releasedAt: '2026-10-07T01:00:00Z', segments: [
  { id: 's1', content: 'First narration', expectedAudioParts: 3, audio: [{ partIndex: 0, url: '/audio/0' }, { partIndex: 2, url: '/audio/2' }] },
  { id: 's2', content: 'Silent narration', expectedAudioParts: 1, audio: [] },
  { id: 's3', content: 'Last narration', expectedAudioParts: 1, audio: [{ partIndex: 0, url: '/audio/last' }] },
] };
beforeEach(() => {
  vi.resetAllMocks(); mocks.fetcher.mockResolvedValue(book);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) { mocks.play(this.src); this.dispatchEvent(new Event('play')); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function(this: HTMLMediaElement) { mocks.pause(); this.dispatchEvent(new Event('pause')); });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(mocks.load);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('shows only reader content and marks incomplete and absent audio', async () => {
  render(<ReleasedBookViewer releaseId="r" />); await screen.findByRole('heading', { name: 'Story' });
  expect(screen.getByText('First narration')).toBeTruthy(); expect(screen.getByText('Incomplete audio: 2/3 parts available.')).toBeTruthy();
  expect(screen.getByText('No audio')).toBeTruthy(); expect(screen.queryByRole('textbox')).toBeNull();
});
it('plays parts in order, skips missing audio, and stops after the last part', async () => {
  render(<ReleasedBookViewer releaseId="r" />); await screen.findByRole('heading', { name: 'Story' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Play All' }));
  const audio = screen.getByLabelText('Released book audio');
  expect(mocks.play.mock.calls[0][0]).toContain('/audio/0');
  fireEvent.ended(audio); expect(mocks.play.mock.calls[1][0]).toContain('/audio/2');
  fireEvent.ended(audio); expect(mocks.play.mock.calls[2][0]).toContain('/audio/last');
  fireEvent.ended(audio); expect((screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement).disabled).toBe(true);
});
it('per-segment playback stops before the next segment and supports native seek controls', async () => {
  render(<ReleasedBookViewer releaseId="r" />); await screen.findByRole('heading', { name: 'Story' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Play segment 1' }));
  const audio = screen.getByLabelText('Released book audio') as HTMLAudioElement;
  expect(audio.controls).toBe(true); audio.currentTime = 2; expect(audio.currentTime).toBe(2);
  fireEvent.ended(audio); fireEvent.ended(audio); expect(mocks.play).toHaveBeenCalledTimes(2);
});
it('stops the queue with an error on media failure and releases the player on unmount', async () => {
  const view = render(<ReleasedBookViewer releaseId="r" />); await screen.findByRole('heading', { name: 'Story' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Play All' }));
  const audio = screen.getByLabelText('Released book audio'); fireEvent.error(audio);
  await screen.findByRole('alert'); expect(audio.hasAttribute('src')).toBe(false);
  view.unmount(); expect(mocks.pause).toHaveBeenCalled();
});
it('handles owner-only access and unavailable releases', async () => {
  mocks.fetcher.mockRejectedValue({ statusCode: 403 }); const view = render(<ReleasedBookViewer releaseId="r" />);
  expect((await screen.findByRole('alert')).textContent).toContain('Sign in as the owner'); view.unmount();
  mocks.fetcher.mockRejectedValue({ statusCode: 404 }); render(<ReleasedBookViewer releaseId="r" />);
  expect((await screen.findByRole('alert')).textContent).toContain('not found');
});
it('handles a rejected play promise without continuing the queue', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValueOnce(new Error('Blocked'));
  render(<ReleasedBookViewer releaseId="r" />); await screen.findByRole('heading', { name: 'Story' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play All' })); });
  expect(screen.getByRole('alert').textContent).toContain('Audio playback failed');
});
