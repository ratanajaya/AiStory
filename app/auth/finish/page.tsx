'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function FinishClaim() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ providers: string; destination: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const next = search.get('next');
    const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/';
    fetch('/api/guest/claim', { method: 'POST' }).then(async (response) => {
      if (!response.ok) throw new Error('Could not save your guest work to this account.');
      const result = await response.json();
      window.dispatchEvent(new Event('aistory:usage'));
      if (!cancelled) {
        if (result.preservedKeys?.length) setNotice({ providers: result.preservedKeys.map((provider: string) => provider === 'openAi' ? 'OpenAI' : 'Together AI').join(', '), destination });
        else router.replace(destination);
      }
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Claim failed'); });
    return () => { cancelled = true; };
  }, [router, search]);
  return <div className="mx-auto max-w-lg p-8">{notice ? <><p>Your work is saved. Your existing account keys for {notice.providers} take precedence over the guest keys.</p><button className="mt-4 text-primary underline" onClick={() => router.replace(notice.destination)}>Continue</button></> : error ? <><p>{error}</p><button className="mt-4 text-primary underline" onClick={() => location.reload()}>Retry</button></> : <p>Saving your guest work to your account...</p>}</div>;
}

export default function FinishPage() { return <Suspense fallback={<p className="p-8">Finishing sign-in...</p>}><FinishClaim /></Suspense>; }
