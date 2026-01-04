'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Template, Book } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';

export default function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { fetcher } = useFetcher();

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
        const data = await fetcher<Book[]>('/api/books', {
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

  if (templatesLoading) {
    return <div>Loading templates...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-secondary">Templates</h1>
        <Link href="/templates/new">
          <Button variant="primary">Create New Template</Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-muted-foreground">No templates found. Create one to get started.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-10 border-b border-border p-2"></th>
              <th className="text-left border-b border-border p-2 text-muted-foreground">Name</th>
              <th className="text-left border-b border-border p-2 text-muted-foreground">Template ID</th>
              <th className="text-left border-b border-border p-2 text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <React.Fragment key={template.templateId}>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="border-b border-border p-2 text-center">
                    <button 
                      onClick={() => toggleExpand(template.templateId!)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedTemplates.has(template.templateId!) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      )}
                    </button>
                  </td>
                  <td className="border-b border-border p-2">{template.name}</td>
                  <td className="border-b border-border p-2 font-mono text-sm">{template.templateId}</td>
                  <td className="border-b border-border p-2">
                    <Link href={`/templates/${template.templateId}`}>
                      <Button variant="outline" className="mr-2 h-8 px-3">Edit</Button>
                    </Link>
                    <Button 
                      onClick={() => handleDelete(template.templateId!)} 
                      variant="ghost" 
                      className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-100/10"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
                {expandedTemplates.has(template.templateId!) && (
                  <tr>
                    <td colSpan={4} className="border-b border-border p-4 bg-muted/20">
                      <div className="pl-10">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-semibold text-sm text-muted-foreground">Books</h3>
                          <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => {}}>New Book</Button>
                        </div>
                        {booksLoading ? (
                          <p className="text-sm text-muted-foreground">Loading books...</p>
                        ) : (
                          <ul className="space-y-2">
                            {books.filter(b => b.templateId === template.templateId).map(book => (
                              <li key={book.bookId}>
                                <Link href={`/book/${book.bookId}`} className="text-primary hover:underline flex items-center gap-2 text-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                                  Book {book.bookId}
                                </Link>
                              </li>
                            ))}
                            {books.filter(b => b.templateId === template.templateId).length === 0 && (
                              <li className="text-sm text-muted-foreground italic">No books created yet.</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
