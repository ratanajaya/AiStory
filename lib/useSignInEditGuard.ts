'use client';
import { useEffect } from 'react';
import { useAlert } from '@/components/AlertBox';

export function useSignInEditGuard(editing: boolean) {
  const { showAlert } = useAlert();
  useEffect(() => {
    if (!editing) return;
    const beforeSignIn = (event: Event) => {
      event.preventDefault();
      showAlert('Save or cancel the open edit before signing in. Your workspace is still available.', { type: 'info' });
    };
    window.addEventListener('aistory:before-signin', beforeSignIn);
    return () => window.removeEventListener('aistory:before-signin', beforeSignIn);
  }, [editing, showAlert]);
}
