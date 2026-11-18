import { useFetcher } from '@/components/FetcherProvider';
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { Tooltip } from '@/components/Tooltip';
import { useCallback, useEffect, useRef, useState } from "react";
import Link from 'next/link';
import { Panel } from "react-resizable-panels";
import { NarrationMode } from "@/types";
import { narrationModeIds, narrationModes } from '@/lib/narrationModes';
import { BookUIModel } from "@/types/extendedTypes";
import _util from "@/utils/_util";
import { SegmentDirectionPreview } from './SegmentDirectionPreview';
import { useSegmentAutocomplete } from './useSegmentAutocomplete';

export default function useInputPanel(props:{
  ready: boolean;
  disabled?: boolean;
  modeDisabled?: boolean;
  inputTag: string;
  book: BookUIModel;
}){
  const { fetcher } = useFetcher();
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSave = useRef<Promise<unknown>>(Promise.resolve());
  const restoredBook = useRef<string | null>(null);
  // Use refs instead of state to avoid re-renders
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [modeSelection, setModeSelection] = useState<{ bookId: string; mode: NarrationMode }>({ bookId: props.book.bookId, mode: 'outline' });
  if (modeSelection.bookId !== props.book.bookId) {
    setModeSelection({ bookId: props.book.bookId, mode: 'outline' });
  }
  const mode = modeSelection.bookId === props.book.bookId ? modeSelection.mode : 'outline';

  useEffect(() => {
    if (!props.ready || !inputRef.current || !props.book.bookId || restoredBook.current === props.book.bookId) return;
    if (inputRef.current) inputRef.current.value = _util.toInputString(props.book.draftOutline);
    restoredBook.current = props.book.bookId;
  }, [props.ready, props.book.bookId, props.book.draftOutline]);

  const flushDraft = useCallback(async () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (!props.book.bookId || !inputRef.current) return;
    const values = { draftOutline: _util.toInputString(inputRef.current.value) };
    draftSave.current = draftSave.current.catch(() => {}).then(() => fetcher(`/api/books/${props.book.bookId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values), silent: true }));
    await draftSave.current;
  }, [fetcher, props.book.bookId]);
  useEffect(() => () => { if (draftTimer.current) clearTimeout(draftTimer.current); }, []);
  const scheduleDraftSave = () => { if (draftTimer.current) clearTimeout(draftTimer.current); draftTimer.current = setTimeout(() => { void flushDraft().catch(() => {}); }, 500); };
  const autocomplete = useSegmentAutocomplete({
    inputRef,
    bookId: props.book.bookId,
    mode,
    ready: props.ready,
    disabled: Boolean(props.disabled || props.modeDisabled),
    onAccept: scheduleDraftSave,
  });

  // Function to get current values from refs
  const getUserInput = () => ({
    input1: _util.toInputString(inputRef.current?.value),
    narrationMode: mode,
  });

  const element = (
    <Panel defaultSize={18} minSize={5} order={3}>
      <div className='flex h-full min-w-0 flex-col gap-1'>
        <div className="flex shrink-0 items-center gap-2">
          <div role="group" aria-label="Writing mode" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {narrationModeIds.map(value => (
              <Tooltip key={value} content={narrationModes[value].description} triggerClassName='inline-flex shrink-0'>
                <Button
                  type='button'
                  size='small'
                  variant={mode === value ? 'primary' : 'outline'}
                  aria-pressed={mode === value}
                  className='whitespace-nowrap'
                  disabled={!props.ready || props.disabled || props.modeDisabled}
                  onClick={() => setModeSelection({ bookId: props.book.bookId, mode: value })}
                >{narrationModes[value].label}</Button>
              </Tooltip>
            ))}
          </div>
          {autocomplete.suggestion && (
            <button
              type="button"
              className="min-h-6 shrink-0 whitespace-nowrap px-1 text-xs text-primary underline"
              onPointerDown={event => event.preventDefault()}
              onClick={() => autocomplete.accept()}
            >
              Accept suggestion <kbd className="text-muted-foreground">Tab</kbd>
            </button>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          <Textarea
            className="h-full min-h-0 max-h-full"
            rows={2}
            aria-label="Segment direction"
            placeholder={mode === 'outline' ? `${props.inputTag} ${narrationModes[mode].placeholder}` : narrationModes[mode].placeholder}
            disabled={props.disabled}
            ref={inputRef}
            onChange={event => {
              scheduleDraftSave();
              autocomplete.onEdit(event.currentTarget);
            }}
            onSelect={event => autocomplete.onSelectionChange(event.currentTarget)}
            onCompositionStart={event => autocomplete.onCompositionStart(event.currentTarget)}
            onCompositionEnd={event => autocomplete.onCompositionEnd(event.currentTarget)}
            onBlur={autocomplete.onBlur}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Escape' && (autocomplete.suggestion || autocomplete.hasPending())) {
                event.preventDefault();
                autocomplete.dismiss();
              }
              if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && autocomplete.accept()) {
                event.preventDefault();
              }
            }}
          />
          {autocomplete.suggestion && (
            <SegmentDirectionPreview
              inputRef={inputRef}
              draft={autocomplete.suggestion.draft}
              suffix={autocomplete.suggestion.suffix}
            />
          )}
        </div>
        <div className="sr-only" role="status">
          {autocomplete.suggestion && `Suggestion: ${autocomplete.suggestion.suffix}. Press Tab to accept or Escape to dismiss.`}
        </div>
        {autocomplete.needsKey && (
          <div className="shrink-0 text-xs text-muted-foreground">
            Autocomplete needs a provider key.{' '}
            {autocomplete.isAdmin
              ? <Link className="text-primary underline" href="/setting#api-keys">Configure API keys</Link>
              : <button type="button" className="text-primary underline" onClick={() => window.dispatchEvent(new Event('aistory:keys'))}>Add your API key</button>}
          </div>
        )}
      </div>
    </Panel>
  );

  return { element, getUserInput, flushDraft };
}
