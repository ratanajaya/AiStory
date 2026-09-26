import { useFetcher } from '@/components/FetcherProvider';
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { useAlert } from "@/components/AlertBox";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "react-resizable-panels";
import { Template } from "@/types";
import { BookUIModel } from "@/types/extendedTypes";
import _promptUtil from "@/utils/_promptUtil";
import _constant from "@/utils/_constant";
import _util from "@/utils/_util";
import { streamAiRequest, AiStreamError } from "@/lib/aiStreamClient";
import { formatErrorDetail } from "@/lib/errorClient";
import { StatusBarProps } from "./StatusBar";

export default function useInputPanel(props:{
  ready: boolean;
  inputTag: string;
  template: Template | null;
  book: BookUIModel;
  onStatusChange: (status: StatusBarProps) => void;
}){
  const { showAlert } = useAlert();
  const { fetcher } = useFetcher();
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSave = useRef<Promise<unknown>>(Promise.resolve());
  const restoredBook = useRef<string | null>(null);
  // Use refs instead of state to avoid re-renders
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!props.ready || !inputRef.current || !ideaRef.current || !props.book.bookId || restoredBook.current === props.book.bookId) return;
    if (inputRef.current) inputRef.current.value = props.book.draftOutline ?? '';
    if (ideaRef.current) ideaRef.current.value = props.book.draftIdea ?? '';
    restoredBook.current = props.book.bookId;
  }, [props.ready, props.book.bookId, props.book.draftOutline, props.book.draftIdea]);

  const flushDraft = useCallback(async () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (!props.book.bookId || !inputRef.current || !ideaRef.current) return;
    const values = { draftOutline: inputRef.current?.value ?? '', draftIdea: ideaRef.current?.value ?? '' };
    draftSave.current = draftSave.current.catch(() => {}).then(() => fetcher(`/api/books/${props.book.bookId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values), silent: true }));
    await draftSave.current;
  }, [fetcher, props.book.bookId]);
  useEffect(() => () => { if (draftTimer.current) clearTimeout(draftTimer.current); }, []);
  const scheduleDraftSave = () => { if (draftTimer.current) clearTimeout(draftTimer.current); draftTimer.current = setTimeout(() => { void flushDraft().catch(() => {}); }, 500); };

  const hasGenerator = !!props.template?.promptBuilder.outlineIdeaGenerator?.trim();

  // Function to get current values from refs
  const getUserInput = () => ({
    input1: inputRef.current?.value || '',
  });

  const handleGenerateOutline = async () => {
    if (isGenerating || !props.template || !hasGenerator) return;
    setIsGenerating(true);
    props.onStatusChange({
      loading: true,
      text: 'Generating outline...',
    });

    const ideaText = ideaRef.current?.value?.trim() ?? '';
    const existing = inputRef.current?.value ?? '';
    const separator = existing.length > 0 ? _constant.newLine2 : '';
    const prefix = existing + separator;

    if (inputRef.current) {
      inputRef.current.value = prefix;
    }

    let generatedContent = '';

    try {
      // Context message — same shape as the main narration call
      const contextMessage = _promptUtil.craftBookPrompt(
        props.template.promptBuilder.narration1,
        props.template,
        props.book,
        null,
        true,
      );

      // Instruction message — outline generator template with the user's seed idea
      const instructionMessage = _promptUtil.craftBookPrompt(
        props.template.promptBuilder.outlineIdeaGenerator,
        props.template,
        props.book,
        null,
        true,
        { textboxInput: ideaText },
      );
      const userMessage = [contextMessage, instructionMessage].filter(Boolean).join(_constant.newLine2);

      const cleaned = await streamAiRequest(
        {
          feature: 'outlineIdeaGenerator',
          systemMessage: props.template.promptBuilder.outlineIdeaGeneratorSystem,
          messages: [{ role: 'user', content: userMessage }],
          logContext: { feature: 'Outline generator', bookId: props.book.bookId, bookName: props.book.name },
        },
        {
          onChunk: (chunk) => {
            generatedContent += chunk;
            if (inputRef.current) {
              inputRef.current.value = inputRef.current.value + chunk;
            }
          },
        },
      );

      if (inputRef.current) {
        inputRef.current.value = prefix + cleaned;
      }
      scheduleDraftSave();
      props.onStatusChange({
        loading: false,
        text: 'Outline generation complete',
      });
    } catch (err) {
      const envelope = err instanceof AiStreamError ? err.envelope : undefined;
      const message = err instanceof Error ? err.message : 'Outline generation failed';
      if (_util.isNullOrWhitespace(generatedContent) && inputRef.current) {
        inputRef.current.value = prefix;
      }
      showAlert(message, { type: 'error', detail: formatErrorDetail(envelope) });
      props.onStatusChange({
        loading: false,
        text: 'Outline generation failed',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const element = (
    <Panel defaultSize={18} minSize={5} order={3}>
      <div className='flex h-full flex-col gap-1'>
        <div className='flex items-start gap-1'>
          <Textarea
            className='flex-1 min-h-0'
            placeholder='Outline idea (optional)'
            rows={1}
            size='small'
            ref={ideaRef}
            onChange={scheduleDraftSave}
            disabled={isGenerating}
          />
          <Button
            variant='secondary'
            size='small'
            onClick={handleGenerateOutline}
            disabled={isGenerating || !hasGenerator}
            title={hasGenerator
              ? 'Generate outline (uses promptBuilder.outlineIdeaGenerator)'
              : 'Set promptBuilder.outlineIdeaGenerator on this template to enable'}
          >
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
        <Textarea
          className='flex-1 min-h-0'
          placeholder={props.inputTag}
          ref={inputRef}
          onChange={scheduleDraftSave}
        />
      </div>
    </Panel>
  );

  return { element, getUserInput, flushDraft, isGenerating };
}
