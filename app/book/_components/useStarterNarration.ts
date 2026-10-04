import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, StorySegment, Template } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { streamAiRequest, AiStreamError } from '@/lib/aiStreamClient';
import { createNarrationRequest } from '@/lib/narrationRequest';
import { formatErrorDetail } from '@/lib/errorClient';
import _util from '@/utils/_util';
import type { StatusBarProps } from '@/app/book/_components/StatusBar';

type Phase = 'idle' | 'generating' | 'saving' | 'generationError' | 'saveError';

export default function useStarterNarration(options: {
  ready: boolean;
  book: Book;
  template: Template | null;
  onStatusChange: (status: StatusBarProps) => void;
  onSaved: (segment: StorySegment) => void;
}) {
  const { fetcher } = useFetcher();
  const started = useRef(false);
  const running = useRef(false);
  const source = useRef<StorySegment | null>(null);
  const completed = useRef<StorySegment | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<StorySegment | null>(null);
  const [error, setError] = useState('');
  const { book, template, onSaved, onStatusChange } = options;

  const save = useCallback(async (segment: StorySegment) => {
    setPhase('saving');
    onStatusChange({ loading: true, text: 'Saving starter narration...' });
    try {
      try {
        await fetcher(`/api/books/${book.bookId}/segments`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment }), silent: true,
        });
      } catch (saveError) {
        // A lost response or a duplicate-ID retry may follow a successful write.
        const stored = await fetcher<Book>(`/api/books/${book.bookId}`, { silent: true });
        const match = stored.storySegments.find(item => item.id === segment.id);
        if (!match || match.role !== segment.role || match.content !== segment.content
          || match.day !== segment.day || match.narrationModel?.service !== segment.narrationModel?.service
          || match.narrationModel?.model !== segment.narrationModel?.model) throw saveError;
      }
      onSaved(segment);
      completed.current = null;
      setPreview(null);
      setPhase('idle');
      onStatusChange({ loading: false, text: 'Starter narration saved' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save starter narration');
      setPhase('saveError');
      onStatusChange({ loading: false, text: 'Starter narration could not be saved' });
    }
  }, [book.bookId, fetcher, onSaved, onStatusChange]);

  const generate = useCallback(async () => {
    if (running.current || !template || !source.current) return;
    running.current = true;
    setError('');
    try {
      if (completed.current) {
        await save(completed.current);
        return;
      }
      setPhase('generating');
      onStatusChange({ loading: true, text: 'Generating starter narration...' });
      let segment: StorySegment = {
        id: Math.max(Date.now(), Number(source.current.id) + 1).toString(),
        day: 0, role: 'assistant', content: '',
      };
      setPreview(segment);
      // Exclude the saved outline from prior-story context; narration2 receives it as input.
      const content = await streamAiRequest(createNarrationRequest(template, book, source.current.content, source.current.id), {
        onModel: (model) => {
          segment = { ...segment, ...(model && { narrationModel: model }) };
          setPreview(segment);
        },
        onChunk: (chunk) => {
          segment = { ...segment, content: segment.content + chunk };
          setPreview(segment);
        },
      });
      if (_util.isNullOrWhitespace(content)) throw new Error('Starter narration response is empty');
      segment = { ...segment, content };
      completed.current = segment;
      setPreview(segment);
      await save(segment);
    } catch (err) {
      const detail = err instanceof AiStreamError ? formatErrorDetail(err.envelope) : undefined;
      setError([err instanceof Error ? err.message : 'Starter narration failed', detail].filter(Boolean).join('\n'));
      setPhase('generationError');
      onStatusChange({ loading: false, text: 'Starter narration failed' });
    } finally {
      running.current = false;
    }
  }, [book, template, save, onStatusChange]);

  useEffect(() => {
    if (!options.ready || !template || !book.bookId || started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const segmentId = url.searchParams.get('starterSegmentId');
    if (!segmentId) return;
    url.searchParams.delete('starterSegmentId');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    const first = book.storySegments[0];
    if (book.storySegments.length !== 1 || first.role !== 'user' || first.id !== segmentId) return;
    source.current = first;
    void generate();
  }, [options.ready, template, book, generate]);

  return {
    pending: phase !== 'idle',
    busy: phase === 'generating' || phase === 'saving',
    canSave: phase === 'saveError',
    preview, error,
    label: phase === 'generating' ? 'Generating starter narration...' : phase === 'saving' ? 'Saving starter narration...' : 'Starter narration needs a retry',
    retry: generate,
  };
}
