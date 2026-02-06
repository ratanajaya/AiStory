'use client';

import { useState } from 'react';
import { Input } from '@/components/Input';
import { useFetcher } from '@/components/FetcherProvider';
import { useAlert } from '@/components/AlertBox';

interface BookNameEditorProps {
  bookId: string;
  bookName: string | null;
  onNameUpdate: (newName: string) => void;
  onStatusChange: (status: { loading: boolean; text: string }) => void;
}

export default function BookNameEditor({
  bookId,
  bookName,
  onNameUpdate,
  onStatusChange,
}: BookNameEditorProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const { fetcher } = useFetcher();
  const { showAlert } = useAlert();

  const handleSaveBookName = async () => {
    try {
      onStatusChange({
        loading: true,
        text: 'Updating book name...',
      });

      await fetcher(`/api/books/${bookId}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editedName }),
        errorMessage: 'Failed to update book name',
      });

      onNameUpdate(editedName);
      setIsEditingName(false);
      
      onStatusChange({
        loading: false,
        text: 'Book name updated successfully.',
      });
    } catch (error: any) {
      showAlert(error?.message || 'Failed to update book name');
      onStatusChange({
        loading: false,
        text: 'Failed to update book name.',
      });
    }
  };

  return (
    <div className="mb-4 flex items-center gap-2 group">
      {isEditingName ? (
        <>
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            placeholder="Enter book name"
            className="text-xl font-bold"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveBookName();
              } else if (e.key === 'Escape') {
                setIsEditingName(false);
                setEditedName(bookName || '');
              }
            }}
          />
          <button
            onClick={handleSaveBookName}
            disabled={!editedName.trim()}
            className="p-1.5 rounded hover:bg-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Save"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          <button
            onClick={() => {
              setIsEditingName(false);
              setEditedName(bookName || '');
            }}
            className="p-1.5 rounded hover:bg-red-600/20 transition-colors"
            title="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">
            {bookName || 'Untitled Book'}
          </h1>
          <button
            onClick={() => {
              setIsEditingName(true);
              setEditedName(bookName || '');
            }}
            className="p-1.5 rounded hover:bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit Name"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
