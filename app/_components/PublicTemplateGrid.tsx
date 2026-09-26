'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFetcher } from '@/components/FetcherProvider';
import { Card } from '@/components/Card';

type PublicCard = { templateId: string; name: string; storyBackground: string; imageUrl: string | null };

export default function PublicTemplateGrid() {
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const { fetcher } = useFetcher();
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    fetcher<PublicCard[]>('/api/public/templates', { silent: true }).then((value) => { if (mounted) setCards(value); }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [fetcher]);
  async function start(templateId: string) {
    setStarting(templateId);
    try {
      const result = await fetcher<{ bookId: string }>(`/api/public/templates/${templateId}/start`, { method: 'POST' });
      router.push(`/book/${result.bookId}`);
    } catch { setStarting(null); }
  }
  if (loading) return <p className="text-muted-foreground">Loading public templates...</p>;
  if (!cards.length) return <p className="text-muted-foreground">No public templates yet. Create your own template to start writing.</p>;
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map((card) =>
    <Card key={card.templateId} className="overflow-hidden">
      <div className="relative aspect-3/2 bg-muted">{card.imageUrl && <Image src={card.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 25vw" />}</div>
      <div className="p-4"><h3 className="font-semibold">{card.name}</h3><p className="my-2 line-clamp-2 text-sm text-muted-foreground">{card.storyBackground}</p>
        <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={starting !== null} onClick={() => start(card.templateId)}>{starting === card.templateId ? 'Starting...' : 'Start Book'}</button>
      </div>
    </Card>)}</div>;
}
