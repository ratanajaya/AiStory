import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { useRef, useState } from "react";
import { Panel } from "react-resizable-panels";
import { Template } from "@/types";
import { BookUIModel } from "@/types/extendedTypes";
import _promptUtil from "@/utils/_promptUtil";
import _util from "@/utils/_util";
import _constant from "@/utils/_constant";

export default function useInputPanel(props:{
  inputTag: string;
  template: Template | null;
  book: BookUIModel;
}){
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

    const ideaText = ideaRef.current?.value?.trim() ?? '';
    const existing = inputRef.current?.value ?? '';
    const separator = existing.length > 0 ? _constant.newLine2 : '';
    let accumulatedContent = '';

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

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemMessage: null,
          messages: [
            { role: 'user', content: contextMessage },
            { role: 'user', content: instructionMessage },
          ],
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to generate outline');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;
        if (inputRef.current) {
          inputRef.current.value = existing + separator + accumulatedContent;
        }
      }

      const cleaned = _util.cleanupLlmResponse(accumulatedContent);
      if (inputRef.current) {
        inputRef.current.value = existing + separator + cleaned;
      }
    } catch (error) {
      console.error('Error during outline generation:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const element = (
    <Panel defaultSize={15} minSize={5} order={3}>
      <div className='flex h-full flex-col gap-1'>
        <div className='flex gap-1'>
          <Textarea
            className='flex-1 min-h-0'
            placeholder='Outline idea (optional)'
            rows={2}
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
