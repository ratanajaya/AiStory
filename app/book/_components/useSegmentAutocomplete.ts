import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useFetcher } from '@/components/FetcherProvider';
import {
  AUTOCOMPLETE_DELAY_MS,
  AUTOCOMPLETE_MAX_DRAFT_LENGTH,
  AUTOCOMPLETE_MIN_DRAFT_LENGTH,
  type AutocompleteRequest,
  type AutocompleteResponse,
} from '@/lib/autocomplete';
import type { AutocompleteAvailability, NarrationMode } from '@/types';

type Viewer = { isAdmin: boolean; autocomplete?: AutocompleteAvailability };

function caretAtEnd(field: HTMLTextAreaElement) {
  return field.selectionStart === field.value.length && field.selectionEnd === field.value.length;
}

export function useSegmentAutocomplete({ inputRef, bookId, mode, ready, disabled, onAccept }: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  bookId: string;
  mode: NarrationMode;
  ready: boolean;
  disabled: boolean;
  onAccept: () => void;
}) {
  const { fetcher } = useFetcher();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const model = viewer?.autocomplete?.model;
  const available = Boolean(viewer?.autocomplete?.available);
  const scope = JSON.stringify([bookId, mode, ready, disabled, available, model?.service, model?.model]);
  const [preview, setPreview] = useState<{ draft: string; suffix: string; scope: string } | null>(null);
  if (preview && preview.scope !== scope) setPreview(null);
  const suggestion = preview?.scope === scope ? preview : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<AbortController | null>(null);
  const compositionStartValue = useRef<string | null>(null);

  const stopRequest = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current?.abort();
    pending.current = null;
  }, []);

  const dismiss = useCallback(() => {
    stopRequest();
    setPreview(null);
  }, [stopRequest]);

  useLayoutEffect(() => stopRequest, [scope, stopRequest]);

  useEffect(() => {
    if (!ready || !bookId) return;
    let request: AbortController | undefined;
    const refresh = () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      void fetcher<Viewer>('/api/viewer', { silent: true, cache: 'no-store', signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setViewer(value); })
        .catch(() => { if (!controller.signal.aborted) setViewer(null); });
    };
    const settingsChanged = () => {
      dismiss();
      setViewer(null);
      refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('aistory:actor', settingsChanged);
    window.addEventListener('aistory:settings', settingsChanged);
    window.addEventListener('aistory:before-signin', dismiss);
    return () => {
      request?.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aistory:actor', settingsChanged);
      window.removeEventListener('aistory:settings', settingsChanged);
      window.removeEventListener('aistory:before-signin', dismiss);
    };
  }, [bookId, ready, fetcher, dismiss]);

  function onEdit(field: HTMLTextAreaElement) {
    dismiss();
    if (!ready || disabled || !available || compositionStartValue.current !== null || !caretAtEnd(field)) return;
    const draft = field.value;
    const draftTail = Array.from(draft.slice(-AUTOCOMPLETE_MAX_DRAFT_LENGTH * 2)).slice(-AUTOCOMPLETE_MAX_DRAFT_LENGTH).join('');
    if (Array.from(draftTail.trim()).length < AUTOCOMPLETE_MIN_DRAFT_LENGTH) return;

    const matchesDraft = () => inputRef.current === field && document.activeElement === field
      && field.value === draft && caretAtEnd(field);
    const payload: AutocompleteRequest = { bookId, draftTail };
    timer.current = setTimeout(async () => {
      timer.current = null;
      if (!matchesDraft()) return;
      const controller = new AbortController();
      pending.current = controller;
      try {
        const result = await fetcher<AutocompleteResponse>('/api/ai/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
          silent: true,
        });
        if (pending.current === controller && matchesDraft() && result?.suffix?.trim()) {
          setPreview({ draft, suffix: result.suffix, scope });
        }
      } catch {
        // Suggestions are optional while editing.
      } finally {
        if (pending.current === controller) pending.current = null;
      }
    }, AUTOCOMPLETE_DELAY_MS);
  }

  function accept() {
    const field = inputRef.current;
    if (!suggestion || !field || field.value !== suggestion.draft || !caretAtEnd(field)) return false;
    field.setRangeText(suggestion.suffix, field.value.length, field.value.length, 'end');
    dismiss();
    onAccept();
    return true;
  }

  return {
    needsKey: Boolean(model && !available),
    isAdmin: Boolean(viewer?.isAdmin),
    suggestion,
    accept,
    dismiss,
    onEdit,
    onSelectionChange(field: HTMLTextAreaElement) {
      if (!caretAtEnd(field)) dismiss();
    },
    onCompositionStart(field: HTMLTextAreaElement) {
      dismiss();
      compositionStartValue.current = field.value;
    },
    onCompositionEnd(field: HTMLTextAreaElement) {
      const startValue = compositionStartValue.current;
      compositionStartValue.current = null;
      if (startValue !== field.value) onEdit(field);
    },
    onBlur() {
      compositionStartValue.current = null;
      dismiss();
    },
    hasPending: () => timer.current !== null || pending.current !== null,
  };
}
