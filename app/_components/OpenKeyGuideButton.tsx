'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useFetcher } from '@/components/FetcherProvider';

export default function OpenKeyGuideButton() {
  const { fetcher } = useFetcher();
  const pathname = usePathname();
  const { status } = useSession();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    fetcher<{ isAdmin: boolean }>('/api/viewer', { silent: true })
      .then((viewer) => { if (active) setVisible(!viewer.isAdmin); })
      .catch(() => { if (active) setVisible(false); });
    return () => { active = false; };
  }, [fetcher, pathname, status]);
  if (!visible) return null;
  return <button className="rounded border border-border px-4 py-2" onClick={() => window.dispatchEvent(new Event('aistory:keys'))}>Use your own API key</button>;
}
