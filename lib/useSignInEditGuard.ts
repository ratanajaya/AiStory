'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useAlert } from '@/components/AlertBox';

const edits = new Set<symbol>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export function useHasOpenEdits() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => edits.size > 0, () => false);
}

export function useSignInEditGuard(editing: boolean) {
  const { showAlert } = useAlert();
  useEffect(() => {
    if (!editing) return;
    const token = Symbol(); edits.add(token); notify();
    const beforeSignIn = (event: Event) => {
      event.preventDefault();
      showAlert('Save or cancel the open edit before signing in. Your workspace is still available.', { type: 'info' });
    };
    window.addEventListener('aistory:before-signin', beforeSignIn);
    return () => { window.removeEventListener('aistory:before-signin', beforeSignIn); edits.delete(token); notify(); };
  }, [editing, showAlert]);
}
