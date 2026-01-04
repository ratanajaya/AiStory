'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Template } from '@/types';

export default function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete template');
      }
      // Refresh the list
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  if (loading) {
    return <div>Loading templates...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Link href="/templates/new">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Create New Template</button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <p>No templates found. Create one to get started.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left border-b border-gray-300 p-2">Name</th>
              <th className="text-left border-b border-gray-300 p-2">Template ID</th>
              <th className="text-left border-b border-gray-300 p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.templateId}>
                <td className="border-b border-gray-100 p-2">{template.name}</td>
                <td className="border-b border-gray-100 p-2">{template.templateId}</td>
                <td className="border-b border-gray-100 p-2">
                  <Link href={`/templates/${template.templateId}`}>
                    <button className="mr-2 px-3 py-1 border rounded hover:bg-gray-100">Edit</button>
                  </Link>
                  <button onClick={() => handleDelete(template.templateId!)} className="px-3 py-1 border border-red-500 text-red-500 rounded hover:bg-red-50">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
