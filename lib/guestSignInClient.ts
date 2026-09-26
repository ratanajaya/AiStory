'use client';

export type BeforeSignInDetail = { pending: Promise<unknown>[]; returnTo?: string };

export async function prepareGuestSignIn() {
  const detail: BeforeSignInDetail = { pending: [] };
  const event = new CustomEvent<BeforeSignInDetail>('aistory:before-signin', { cancelable: true, detail });
  window.dispatchEvent(event);
  if (event.defaultPrevented) { await Promise.allSettled(detail.pending); return null; }
  try { await Promise.all(detail.pending); return detail; } catch { return null; }
}
