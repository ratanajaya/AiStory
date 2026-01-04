'use client';

import { useEffect, useState, use } from 'react';
import { Book } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default function BookPage({ params }: PageProps) {
  const { bookId } = use(params);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const { fetcher } = useFetcher();

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);        
        const data = await fetcher<Book>(`/api/books/${bookId}`, {
          errorMessage: 'Failed to fetch book',
        });
        setBook(data);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      fetchBook();
    }
  }, [bookId, fetcher]);

  if (loading) {
    return <div className="p-8">Loading book...</div>;
  }

  if (!book) {
    return <div className="p-8">Book not found</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Book: {book.bookId}</h1>
      <pre className="bg-muted p-4 rounded overflow-auto max-h-[80vh]">
        {JSON.stringify(book, null, 2)}
      </pre>
    </div>
  );
}
