import type { Book, NarrationMode, Template } from '@/types';
import type { AiStreamRequest } from '@/lib/aiStreamClient';
import { appendLongTermMemorySystemInstruction } from '@/lib/bookMemory';
import { buildBookStoryContext } from '@/lib/bookStoryContext';
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
  const context = buildBookStoryContext(template, book, idLimitExclusive);
  const userInput = _promptUtil.craftBookPrompt(prompts.request, template, book, idLimitExclusive, true, { textboxInput: userSegmentContent });
  return {
    feature: 'narration',
    systemMessage: appendLongTermMemorySystemInstruction(prompts.system, book.longTermMemory, mode === 'outline' ? 'OUTLINE' : 'SEGMENT DIRECTION'),
    messages: [{ role: 'user', content: [context, userInput].filter(Boolean).join(_constant.newLine2) }],
    logContext: { feature: 'Narration', bookId: book.bookId, bookName: book.name },
  };
}
