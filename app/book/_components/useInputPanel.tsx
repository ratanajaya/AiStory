import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { useAlert } from "@/components/AlertBox";
import { useRef, useState } from "react";
import { Panel } from "react-resizable-panels";
import { Template } from "@/types";
import { BookUIModel } from "@/types/extendedTypes";
import _promptUtil from "@/utils/_promptUtil";
import _constant from "@/utils/_constant";
import { streamAiRequest, AiStreamError } from "@/lib/aiStreamClient";
import { formatErrorDetail } from "@/lib/errorClient";
import { StatusBarProps } from "./StatusBar";

export default function useInputPanel(props:{
  inputTag: string;
  template: Template | null;
  book: BookUIModel;
  onStatusChange: (status: StatusBarProps) => void;
}){
  const { showAlert } = useAlert();
  // Use refs instead of state to avoid re-renders
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

      const cleaned = await streamAiRequest(
        {
          systemMessage: null,
          messages: [
            { role: 'user', content: contextMessage },
            { role: 'user', content: instructionMessage },
          ],
          logContext: { feature: 'Outline generator', bookId: props.book.bookId, bookName: props.book.name },
        },
        {
          onChunk: (chunk) => {
            if (inputRef.current) {
              inputRef.current.value = inputRef.current.value + chunk;
            }
          },
        },
      );

      if (inputRef.current) {
        inputRef.current.value = prefix + cleaned;
      }
      props.onStatusChange({
        loading: false,
        text: 'Outline generation complete',
      });
    } catch (err) {
      const envelope = err instanceof AiStreamError ? err.envelope : undefined;
      const message = err instanceof Error ? err.message : 'Outline generation failed';
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
        />
      </div>
    </Panel>
  );

  return { element, getUserInput };
}
