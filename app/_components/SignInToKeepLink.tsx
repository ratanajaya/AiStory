'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { prepareGuestSignIn } from '@/lib/guestSignInClient';

export default function SignInToKeepLink({ children = 'Sign in to keep your work', className, onNavigate }: { children?: ReactNode; className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const destination = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const prepared = await prepareGuestSignIn();
    if (!prepared) return;
    onNavigate?.();
    router.push(`/login?callbackUrl=${encodeURIComponent(prepared.returnTo ?? pathname)}`);
  }
  return <Link className={className} href={destination} onClick={(event) => { void handleClick(event); }}>{children}</Link>;
}
