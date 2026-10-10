import type { Book, NarrationMode, Template } from '@/types';
import type { AiStreamRequest } from '@/lib/aiStreamClient';
import { appendLongTermMemorySystemInstruction, appendLongTermMemoryToNarrationContext } from '@/lib/bookMemory';
import _promptUtil from '@/utils/_promptUtil';
import _constant from '@/utils/_constant';
import { getNarrationPrompts } from '@/lib/narrationModes';

export function createNarrationRequest(
  template: Template,
  book: Book,
  userSegmentContent: string,
  idLimitExclusive: string | null,
  mode: NarrationMode = 'outline',
): AiStreamRequest {
  const prompts = getNarrationPrompts(template.promptBuilder, mode);
  const context = _promptUtil.craftBookPrompt(template.promptBuilder.narration1, template, book, idLimitExclusive, true);
  const userInput = _promptUtil.craftBookPrompt(prompts.request, template, book, idLimitExclusive, true, { textboxInput: userSegmentContent });
  return {
    feature: 'narration',
    systemMessage: appendLongTermMemorySystemInstruction(prompts.system, book.longTermMemory, mode === 'outline' ? 'OUTLINE' : 'SEGMENT DIRECTION'),
    messages: [{ role: 'user', content: [appendLongTermMemoryToNarrationContext(context, book.longTermMemory), userInput].filter(Boolean).join(_constant.newLine2) }],
    logContext: { feature: 'Narration', bookId: book.bookId, bookName: book.name },
  };
}
