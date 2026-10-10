'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFetcher } from '@/components/FetcherProvider';
import { Card } from '@/components/Card';
interface ReleaseCard { releaseId: string; title: string; releasedAt: string; segmentCount: number; audioParts: number; expectedAudioParts: number }
export default function ReleasedBookGrid() {
  const { fetcher } = useFetcher(); const [books, setBooks] = useState<ReleaseCard[]>([]); const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetcher<ReleaseCard[]>('/api/released-books', { silent: true }).then(data => { if (!cancelled) setBooks(data); }).catch((cause: { statusCode?: number }) => {
      if (!cancelled && cause.statusCode !== 401 && cause.statusCode !== 403) setError(true);
    });
    return () => { cancelled = true; };
  }, [fetcher]);
  return <section aria-label="Released Books" className="mt-10">
    <h2 className="text-xl font-semibold text-secondary mb-4">Released Books</h2>
    {error ? <p role="alert">Could not load released books. Refresh to retry.</p> : books.length === 0 ? <p className="text-muted-foreground">Release a book from its editor to read it here.</p> :
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{books.map(book => <Card key={book.releaseId} className="p-4">
        <Link className="text-lg font-semibold text-primary hover:underline" href={`/released-books/${book.releaseId}`}>{book.title}</Link>
        <p className="text-sm text-muted-foreground mt-2">Released {new Date(book.releasedAt).toLocaleDateString()}</p>
        <p className="text-sm mt-2">{book.segmentCount} segments; {book.audioParts}/{book.expectedAudioParts} audio parts</p>
      </Card>)}</div>}
  </section>;
}
