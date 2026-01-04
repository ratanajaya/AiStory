'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Template } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Button } from '@/components/Button';

export default function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { fetcher } = useFetcher();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const data = await fetcher<Template[]>('/api/templates', {
          errorMessage: 'Failed to fetch templates',
        });
        setTemplates(data);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [fetcher, refreshKey]);

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

  if (loading) {
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
              <th className="text-left border-b border-border p-2 text-muted-foreground">Name</th>
              <th className="text-left border-b border-border p-2 text-muted-foreground">Template ID</th>
              <th className="text-left border-b border-border p-2 text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.templateId} className="hover:bg-muted/50 transition-colors">
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
