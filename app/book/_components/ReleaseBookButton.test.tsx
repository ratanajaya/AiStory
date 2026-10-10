/** @vitest-environment jsdom */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), collect: vi.fn(), upload: vi.fn(), busy: vi.fn(), openEdits: false }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/lib/releaseAudioClient', () => ({ collectReleaseAudio: mocks.collect }));
vi.mock('@/lib/useSignInEditGuard', () => ({ useHasOpenEdits: () => mocks.openEdits }));
vi.mock('@/app/_components/SignInToKeepLink', () => ({ default: ({ children }: { children: React.ReactNode }) => <a href="/login">{children}</a> }));
import ReleaseBookButton from '@/app/book/_components/ReleaseBookButton';
const attempt = { attemptId: 'a', title: 'Story', replacing: true, segments: [{ id: 's', content: 'Text' }], selectedTts: {} };
beforeEach(() => {
  vi.resetAllMocks(); mocks.openEdits = false;
  mocks.fetcher.mockImplementation(async (url: string) => url === '/api/viewer' ? { kind: 'user' } : url.endsWith('/release') ? attempt : url.endsWith('/uploads') ? { uploads: [] } : { releaseId: 'stable' });
  mocks.collect.mockResolvedValue({ files: [], expectedParts: 1 }); vi.stubGlobal('fetch', mocks.upload);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows saved coverage and replacement notice, then links to the stable reader', async () => {
  const user = userEvent.setup(); render(<ReleaseBookButton bookId="b" disabled={false} onBusyChange={mocks.busy} />);
  await user.click(screen.getByRole('button', { name: 'Release' }));
  await screen.findByText('1 saved segments; 0 of 1 audio parts available.');
  expect(screen.getByText(/This replaces the previous release/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Replace release' }));
  expect((await screen.findByRole('link', { name: 'Open released book' })).getAttribute('href')).toBe('/released-books/stable');
  expect(mocks.upload).not.toHaveBeenCalled();
});
it('requires guests to sign in without creating any release attempt', async () => {
  mocks.fetcher.mockResolvedValue({ kind: 'guest' }); render(<ReleaseBookButton bookId="b" disabled={false} onBusyChange={mocks.busy} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Release' }));
  await screen.findByRole('link', { name: 'Sign in to release' }); expect(mocks.fetcher).toHaveBeenCalledTimes(1); expect(mocks.collect).not.toHaveBeenCalled();
});
it('disables release when editor actions or open edits are unresolved', () => {
  mocks.openEdits = true; render(<ReleaseBookButton bookId="b" disabled={false} onBusyChange={mocks.busy} />);
  expect((screen.getByRole('button', { name: 'Release' }) as HTMLButtonElement).disabled).toBe(true);
});
it('reports failed uploads and never commits partial release audio', async () => {
  mocks.collect.mockResolvedValue({ files: [{ manifest: { byteSize: 5 }, blob: new Blob(['audio']) }], expectedParts: 1 });
  mocks.fetcher.mockImplementation(async (url: string) => url === '/api/viewer' ? { kind: 'user' } : url.endsWith('/release') ? attempt : { uploads: [{ url: 'https://upload', mimeType: 'audio/mpeg' }] });
  mocks.upload.mockResolvedValue({ ok: false });
  const user = userEvent.setup(); render(<ReleaseBookButton bookId="b" disabled={false} onBusyChange={mocks.busy} />);
  await user.click(screen.getByRole('button', { name: 'Release' })); await screen.findByRole('button', { name: 'Replace release' });
  await user.click(screen.getByRole('button', { name: 'Replace release' }));
  await screen.findByRole('alert'); expect(mocks.fetcher.mock.calls.some(([url]) => url.endsWith('/commit'))).toBe(false);
  expect(screen.getByRole('button', { name: 'Retry release' })).toBeTruthy();
});
it('prevents repeated publication clicks while the manifest is pending', async () => {
  const user = userEvent.setup(); render(<ReleaseBookButton bookId="b" disabled={false} onBusyChange={mocks.busy} />);
  await user.click(screen.getByRole('button', { name: 'Release' })); await screen.findByRole('button', { name: 'Replace release' });
  let finish!: (value: unknown) => void; mocks.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: 'Replace release' }));
  expect((screen.getByRole('button', { name: 'Replace release' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finish({ uploads: [] }));
  await waitFor(() => expect(screen.getByRole('link', { name: 'Open released book' })).toBeTruthy());
});
