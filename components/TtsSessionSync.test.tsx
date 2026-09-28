// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ stop: vi.fn(), session: { data: null as { user: { email: string } } | null, status: 'loading' } }));
vi.mock('next-auth/react', () => ({ useSession: () => mocks.session }));
vi.mock('@/lib/ttsIndexedDb', () => ({ stopAudioPlayback: mocks.stop }));
import { TtsSessionSync } from '@/components/TtsSessionSync';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('ends jobs only on an actor change, not initial resolution or session refresh', () => {
  const event = vi.spyOn(window, 'dispatchEvent');
  const view = render(<TtsSessionSync />);
  mocks.session = { status: 'authenticated', data: { user: { email: 'reader@example.com' } } };
  view.rerender(<TtsSessionSync />);
  mocks.session.status = 'loading'; view.rerender(<TtsSessionSync />);
  mocks.session.status = 'authenticated'; view.rerender(<TtsSessionSync />);
  expect(mocks.stop).not.toHaveBeenCalled();
  mocks.session = { status: 'unauthenticated', data: null }; view.rerender(<TtsSessionSync />);
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(event.mock.calls.map(([value]) => value.type)).toEqual(['aistory:actor', 'aistory:settings']);
});
