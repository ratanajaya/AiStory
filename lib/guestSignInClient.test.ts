/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { prepareGuestSignIn, type BeforeSignInDetail } from './guestSignInClient';

describe('guest sign-in handoff', () => {
  it('waits for pending saves and preserves their destination', async () => {
    let complete!: () => void;
    const save = new Promise<void>((resolve) => { complete = resolve; });
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BeforeSignInDetail>).detail;
      detail.pending.push(save.then(() => { detail.returnTo = '/templates'; }));
    };
    window.addEventListener('aistory:before-signin', listener, { once: true });
    let finished = false;
    const result = prepareGuestSignIn().then((value) => { finished = true; return value; });
    await Promise.resolve();
    expect(finished).toBe(false);
    complete();
    expect((await result)?.returnTo).toBe('/templates');
  });

  it('does not navigate after a failed save', async () => {
    window.addEventListener('aistory:before-signin', (event) => {
      (event as CustomEvent<BeforeSignInDetail>).detail.pending.push(Promise.reject(new Error('offline')));
    }, { once: true });
    expect(await prepareGuestSignIn()).toBeNull();
  });

  it('allows an active editor to prevent navigation', async () => {
    window.addEventListener('aistory:before-signin', (event) => event.preventDefault(), { once: true });
    expect(await prepareGuestSignIn()).toBeNull();
  });
});
