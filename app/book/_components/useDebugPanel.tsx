import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import _constant from '@/utils/_constant';
import { DebugLog } from '@/types';
import _util from '@/utils/_util';
import { BookUIModel } from '@/types/extendedTypes';

type StoryDownload = {
  filename: string;
  content: string;
  url: string;
};

type DebugPanelProps = {
  book: BookUIModel;
};

export default function useDebugPanel({ book }: DebugPanelProps) {
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [storyDownloads, setStoryDownloads] = useState<StoryDownload[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const storyDownloadsRef = useRef<StoryDownload[]>([]);

  useEffect(() => {
    storyDownloadsRef.current = storyDownloads;
  }, [storyDownloads]);

  useEffect(() => {
    return () => {
      storyDownloadsRef.current.forEach(story => URL.revokeObjectURL(story.url));
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  function addDebugLog(content: string, type?: 'info' | 'warning' | 'error') {
    const id = new Date().getTime().toString();
    const newLog: DebugLog = {
      id: id,
      type: type || 'info',
      content
    };

    setDebugLogs(prev => [...prev, newLog]);

    return id;
  }

  function appendDebugLog(id: string, chunk: string) {
    setDebugLogs(prev => prev.map(log => {
      if (log.id === id) {
        return { ...log, content: log.content + chunk };
      }
      return log;
    }));
  }
  
  const handleExportClick = () => {
    const storyContent = _util.getStorySegmentAsString(book.storySegments, [], null, `${_constant.newLine2}---${_constant.newLine2}`, true);
    const filename = `Story-${book.bookId}-[${String(book.storySegments.length).padStart(2, '0')}].md`;
    const storyData = { filename, content: storyContent };

    const blob = new Blob([storyData.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    setStoryDownloads(prev => [...prev, { ...storyData, url }]);
  };

  const element = (
    <>
      <button
        type='button'
        onClick={() => setIsOpen(prev => !prev)}
        className='fixed right-4 bottom-16 z-30 rounded-md border border-border bg-card p-2 text-foreground transition-all hover:brightness-125 cursor-pointer'
        aria-label='Toggle debug panel'
        aria-expanded={isOpen}
        title='Debug panel'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='24'
          height='24'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <path d='M9 3h6' />
          <path d='M10 9V5h4v4' />
          <rect x='4' y='9' width='16' height='11' rx='2' />
          <path d='M8 13h.01' />
          <path d='M16 13h.01' />
          <path d='M9 16h6' />
        </svg>
      </button>

      {isOpen && (
        <div className='fixed inset-0 z-40 bg-black/50 transition-opacity' />
      )}

      <div
        ref={panelRef}
        className={`fixed top-0 right-0 z-50 flex h-full w-80 transform flex-col border-l border-border bg-card transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className='flex items-center justify-between border-b border-border p-4'>
          <h2 className='text-lg font-bold text-secondary'>Debug Panel</h2>
          <button
            type='button'
            onClick={() => setIsOpen(false)}
            className='rounded p-1 transition-colors hover:bg-muted'
            aria-label='Close debug panel'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              aria-hidden='true'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          <div className='rounded-md border border-border bg-card p-3'>
            <button
              type='button'
              className='w-full text-left text-secondary transition-colors hover:text-foreground'
              onClick={handleExportClick}
            >
              Export Story
            </button>

            <div className='mt-3 flex flex-col gap-1'>
              {storyDownloads.map((story, index) => (
                <a
                  key={index}
                  href={story.url}
                  download={story.filename}
                  className='block w-full rounded bg-muted px-2 py-1 text-left text-xs text-foreground hover:brightness-125'
                >
                  {story.filename}
                </a>
              ))}
            </div>
          </div>

          <div className='flex min-h-0 flex-col rounded-md border border-border bg-card'>
            <div className='border-b border-border px-3 py-2 text-center font-semibold'>
              DEBUG
            </div>

            <div className='flex-1 overflow-y-auto p-3'>
              {debugLogs.length === 0 ? (
                <div className='text-sm text-muted-foreground'>No debug logs yet.</div>
              ) : (
                debugLogs.map((log, index) => (
                  <DebugLogDisplay key={index} log={log} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return { element, addDebugLog, appendDebugLog };
}

function DebugLogDisplay({ log }: { log: DebugLog }) {
  return (
    <div className=' p-1 mb-3 border-b border-border'>
      <Markdown>
        {log.content}
      </Markdown>
    </div>
  )
}
