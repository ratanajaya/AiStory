import type { Book, Template } from '@/types';
import type { AiStreamRequest } from '@/lib/aiStreamClient';
import { appendLongTermMemorySystemInstruction, appendLongTermMemoryToNarrationContext } from '@/lib/bookMemory';
import _promptUtil from '@/utils/_promptUtil';
import _constant from '@/utils/_constant';

export function createNarrationRequest(
  template: Template,
  book: Book,
  userSegmentContent: string,
  idLimitExclusive: string | null,
): AiStreamRequest {
  const context = _promptUtil.craftBookPrompt(template.promptBuilder.narration1, template, book, idLimitExclusive, true);
  const userInput = _promptUtil.craftBookPrompt(template.promptBuilder.narration2, template, book, idLimitExclusive, true, { textboxInput: userSegmentContent });
  return {
    feature: 'narration',
    systemMessage: appendLongTermMemorySystemInstruction(template.promptBuilder.narrationSystem, book.longTermMemory),
    messages: [{ role: 'user', content: [appendLongTermMemoryToNarrationContext(context, book.longTermMemory), userInput].filter(Boolean).join(_constant.newLine2) }],
    logContext: { feature: 'Narration', bookId: book.bookId, bookName: book.name },
  };
}
