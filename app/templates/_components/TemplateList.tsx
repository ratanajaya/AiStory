'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Template, Book } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';
import { partitionTemplateItems } from '@/app/templates/_components/templateItems';

export default function TemplateList() {
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [statusError, setStatusError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { fetcher } = useFetcher();
  const router = useRouter();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const data = await fetcher<Template[]>('/api/templates', {
          errorMessage: 'Failed to fetch templates',
        });
        setTemplates(data);
      } catch {
      } finally {
        setTemplatesLoading(false);
      }
    };

    const fetchBooks = async () => {
      try {
        setBooksLoading(true);
        const data = await fetcher<Book[]>('/api/books?select=bookId,name,templateId,isActive', {
          errorMessage: 'Failed to fetch books',
        });
        setBooks(data);
      } catch {
      } finally {
        setBooksLoading(false);
      }
    };

    fetchTemplates();
    fetchBooks();
  }, [fetcher, refreshKey]);

  const toggleExpand = (templateId: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await fetcher(`/api/templates/${templateId}`, {
        method: 'DELETE',
        errorMessage: 'Failed to delete template',
      });
      // Refresh the list
      setRefreshKey((prev) => prev + 1);
    } catch {
    }
  };
  const handleCreateBook = async (templateId: string) => {
    try {
      const result = await fetcher<{ bookId: string }>('/api/books', {
        method: 'POST',
        body: JSON.stringify({ templateId }),
        errorMessage: 'Failed to create book',
      });
      
      if (result && result.bookId) {
        router.push(`/book/${result.bookId}`);
      }
    } catch {
      // Error is handled by fetcher or ignored
    }
  };
  const handleStatus = async (kind: 'templates' | 'books', id: string, isActive: boolean) => {
    const key = `${kind}:${id}`;
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    setStatusError(null);
    try {
      const result = await fetcher<{ isActive: boolean }>(`/api/${kind}/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
        errorMessage: 'Failed to update status',
      });
      if (kind === 'templates') {
        setTemplates(previous => previous.map(item => item.templateId === id ? { ...item, isActive: result.isActive } : item));
      } else {
        setBooks(previous => previous.map(item => item.bookId === id ? { ...item, isActive: result.isActive } : item));
      }
    } catch {
      setStatusError('Failed to update status. Please try again.');
    } finally {
      pendingRef.current.delete(key);
      setPending(new Set(pendingRef.current));
    }
  };

  const statusButton = (kind: 'templates' | 'books', id: string, isActive?: boolean) => (
    <Button variant="outline" size="small" disabled={pending.has(`${kind}:${id}`)}
      onClick={() => handleStatus(kind, id, isActive === false)}>
      {pending.has(`${kind}:${id}`) ? 'Saving...' : isActive === false ? 'Reactivate' : 'Deactivate'}
    </Button>
  );

  const renderBook = (book: Book, hiddenByTemplate = false) => (
    <li key={book.bookId} className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Link href={`/book/${book.bookId}`} className="text-primary hover:underline text-sm">
          {`${book.bookId} - ${book.name ?? 'Untitled'}`}
        </Link>
        {book.isActive === false && <span className="ml-2 text-xs text-muted-foreground">Inactive</span>}
        {hiddenByTemplate && book.isActive !== false && (
          <span className="ml-2 text-xs text-muted-foreground">Hidden while template is inactive</span>
        )}
      </div>
      {statusButton('books', book.bookId, book.isActive)}
    </li>
  );

  const renderTemplate = (template: Template, inactive = false) => {
    const templateBooks = books.filter(book => book.templateId === template.templateId && (inactive || book.isActive !== false));
    return (
      <React.Fragment key={template.templateId}>
        <tr className="hover:bg-muted/50 transition-colors">
          <td className="border-b border-border p-2 text-center">
            <button onClick={() => toggleExpand(template.templateId!)}
              aria-label={`Toggle books for ${template.name}`} aria-expanded={expandedTemplates.has(template.templateId!)}
              className="p-1 hover:bg-muted rounded text-muted-foreground">
              {expandedTemplates.has(template.templateId!) ? <span aria-hidden="true">&#9662;</span> : <span aria-hidden="true">&#9656;</span>}
            </button>
          </td>
          <td className="border-b border-border p-2">{template.name}
            {inactive && <span className="ml-2 text-xs text-muted-foreground">Inactive</span>}
          </td>
          <td className="border-b border-border p-2 font-mono text-sm">{template.templateId}</td>
          <td className="border-b border-border p-2">
            <div className="flex flex-wrap gap-2">
              <Link href={`/templates/${template.templateId}`}><Button variant="outline" size="small">Edit</Button></Link>
              {statusButton('templates', template.templateId!, template.isActive)}
              <Button onClick={() => handleDelete(template.templateId!)} variant="ghost" size="small"
                disabled={pending.has(`templates:${template.templateId}`)} className="text-red-500">Delete</Button>
            </div>
          </td>
        </tr>
        {expandedTemplates.has(template.templateId!) && (
          <tr><td colSpan={4} className="border-b border-border p-4 bg-muted/20">
            <div className="pl-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Books</h3>
                <Button variant="outline" size="small" disabled={inactive || pending.has(`templates:${template.templateId}`)}
                  onClick={() => handleCreateBook(template.templateId!)}>New Book</Button>
              </div>
              {booksLoading ? <p className="text-sm text-muted-foreground">Loading books...</p> : (
                <ul className="space-y-2">
                  {templateBooks.map(book => renderBook(book, inactive))}
                  {templateBooks.length === 0 && <li className="text-sm text-muted-foreground italic">{inactive ? 'No books created yet.' : 'No active books.'}</li>}
                </ul>
              )}
            </div>
          </td></tr>
        )}
      </React.Fragment>
    );
  };

  const renderTable = (items: Template[], inactive = false) => (
    <table className="w-full border-collapse">
      <thead><tr>
        <th className="w-10 border-b border-border p-2"><span className="sr-only">Expand books</span></th>
        {['Name', 'Template ID', 'Actions'].map(label => <th key={label} className="text-left border-b border-border p-2 text-muted-foreground">{label}</th>)}
      </tr></thead>
      <tbody>{items.map(template => renderTemplate(template, inactive))}</tbody>
    </table>
  );

  if (templatesLoading) return <div>Loading templates...</div>;
  const { activeTemplates, inactiveTemplates, inactiveBooks } = partitionTemplateItems(templates, books);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-secondary">Templates</h1>
        <Link href="/templates/new"><Button variant="primary">Create New Template</Button></Link>
      </div>
      {statusError && <p role="alert" className="mb-4 text-red-500">{statusError}</p>}
      {templates.length === 0 ? <p className="text-muted-foreground">No templates found. Create one to get started.</p> : renderTable(activeTemplates)}
      {(inactiveTemplates.length > 0 || inactiveBooks.length > 0) && (
        <section aria-label="Inactive" className="mt-10">
          <h2 className="text-xl font-semibold text-secondary mb-4">Inactive</h2>
          {inactiveTemplates.length > 0 && renderTable(inactiveTemplates, true)}
          {inactiveBooks.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Inactive books from active templates</h3>
              <ul className="space-y-3">{inactiveBooks.map(book => (
                <li key={book.bookId}>
                  <p className="text-xs text-muted-foreground mb-1">Template: {templates.find(template => template.templateId === book.templateId)?.name ?? book.templateId}</p>
                  <ul>{renderBook(book)}</ul>
                </li>
              ))}</ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
