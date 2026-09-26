'use client';

import { useEffect, useState } from 'react';
import SignInToKeepLink from '@/app/_components/SignInToKeepLink';

export default function GuestSignInLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    fetch('/api/viewer').then((response) => response.json()).then((viewer) => setShow(viewer.kind !== 'user')).catch(() => {});
  }, []);
  return show ? <SignInToKeepLink className="rounded border border-border px-4 py-2" /> : null;
}
