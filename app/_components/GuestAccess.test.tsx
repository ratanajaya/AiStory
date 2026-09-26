/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GuestAccess } from './GuestAccess';

const fetcher = vi.fn();
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated' }) }));

afterEach(() => { cleanup(); fetcher.mockReset(); sessionStorage.clear(); });

const viewer = (text: number, audio: number, personal = { together: false, openAi: false }) => ({
  kind: 'guest', expiresAt: '2026-10-01T00:00:00.000Z', remaining: { text, audio }, personal,
  selectedLlm: { service: 'openAi', model: 'test-model' }, textFunding: personal.openAi ? 'personal' : 'trial', audioFunding: personal.together ? 'personal' : 'trial',
});

describe('guest allowance reminder', () => {
  it('appears at 80% use, opens the key guide, and stays dismissed for the tab', async () => {
    fetcher.mockResolvedValue(viewer(4, 3000));
    const rendered = render(<GuestAccess />);
    expect(await screen.findByText(/You have 4 free text generations left/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Use your own API key')[1]);
    expect(screen.getByRole('dialog', { name: 'Use your own API key' })).toBeTruthy();
    expect(screen.getByText(/Audio specifically requires a Together key/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close API key guide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss allowance reminder' }));
    expect(sessionStorage.getItem('aistory-reminder-dismissed')).toBe('1');
    rendered.unmount();
    render(<GuestAccess />);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(screen.queryByText(/You have 4 free text generations left/)).toBeNull();
  });

  it('keeps the audio reminder when an OpenAI key funds text', async () => {
    fetcher.mockResolvedValue(viewer(2, 2000, { together: false, openAi: true }));
    render(<GuestAccess />);
    expect(await screen.findByText(/You have 2000 free audio characters left/)).toBeTruthy();
    expect(screen.queryByText(/free text generations left/)).toBeNull();
  });
});
