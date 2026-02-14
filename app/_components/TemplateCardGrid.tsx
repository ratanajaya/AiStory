'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Template, Book } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Card } from '@/components/Card';

export default function TemplateCardGrid() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetcher } = useFetcher();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [templatesData, booksData] = await Promise.all([
          fetcher<Template[]>('/api/templates', {
            errorMessage: 'Failed to fetch templates',
          }),
          fetcher<Book[]>('/api/books?select=bookId,name,templateId', {
            errorMessage: 'Failed to fetch books',
          }),
        ]);
        if (!cancelled) {
          setTemplates(templatesData);
          setBooks(booksData);
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [fetcher]);

  const handleCreateBook = async (templateId: string) => {
    try {
      const result = await fetcher<{ bookId: string }>('/api/books', {
        method: 'POST',
        body: JSON.stringify({ templateId }),
        errorMessage: 'Failed to create book',
      });

      if (result?.bookId) {
        router.push(`/book/${result.bookId}`);
      }
    } catch {
    }
  };

  const getBooksForTemplate = (templateId: string | null) =>
    books.filter((b) => b.templateId === templateId);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="aspect-3/2 bg-muted rounded-t-lg" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Your library is empty</h2>
        <p className="text-muted-foreground mb-6">
          Create your first template to start writing stories.
        </p>
        <Link
          href="/templates/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:brightness-125 transition-all"
        >
          Create a Template
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {templates.map((template) => {
        const templateBooks = getBooksForTemplate(template.templateId);
        return (
          <Card key={template.templateId} hoverable className="flex flex-col overflow-hidden">
            {/* Image */}
            <div className="aspect-3/2 relative bg-muted overflow-hidden rounded-t-lg">
              {template.imageUrl ? (
                <Image
                  src={template.imageUrl}
                  alt={template.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <path d="M8 7h8" />
                    <path d="M8 11h6" />
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-semibold text-foreground text-lg leading-tight mb-1 truncate">
                {template.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                {template.storyBackground || 'No description'}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  {templateBooks.length} {templateBooks.length === 1 ? 'book' : 'books'}
                </span>
                <button
                  onClick={() => handleCreateBook(template.templateId!)}
                  className="text-xs text-primary hover:text-primary-foreground hover:bg-primary px-2.5 py-1 rounded transition-colors font-medium"
                  title="Start a new book from this template"
                >
                  + Start Book
                </button>
              </div>
            </div>

            {/* Books list (if any) */}
            {templateBooks.length > 0 && (
              <div className="px-4 pb-4">
                <ul className="space-y-1">
                  {templateBooks.slice(0, 3).map((book) => (
                    <li key={book.bookId}>
                      <Link
                        href={`/book/${book.bookId}`}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                      >
                        <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                        <span className="truncate">{book.name ?? 'Untitled'}</span>
                      </Link>
                    </li>
                  ))}
                  {templateBooks.length > 3 && (
                    <li className="text-xs text-muted-foreground italic pl-2.5">
                      +{templateBooks.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
