import type { Book, Template } from '@/types';
import { appendLongTermMemoryToNarrationContext } from '@/lib/bookMemory';
import _promptUtil from '@/utils/_promptUtil';

export function buildBookStoryContext(template: Template, book: Book, idLimitExclusive: string | null = null) {
  const context = _promptUtil.craftBookPrompt(template.promptBuilder.narration1, template, book, idLimitExclusive, true);
  return appendLongTermMemoryToNarrationContext(context, book.longTermMemory);
}
