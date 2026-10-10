import { describe, expect, it } from 'vitest';
import type { Book, NarrationMode, Template } from '@/types';
import { createNarrationRequest } from '@/lib/narrationRequest';
import { appendLongTermMemorySystemInstruction, appendLongTermMemoryToNarrationContext, createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import { defaultNarrationModePrompts, narrationModes } from '@/lib/narrationModes';
import _constant from '@/utils/_constant';
import _promptUtil from '@/utils/_promptUtil';

const template: Template = {
  templateId: 't1', name: 'Template', imageUrl: null, storyBackground: 'John and Bob were classmates.',
  writingStyle: 'Third person; no private thoughts unless supplied.',
  promptBuilder: { ..._constant.emptyPromptBuilder, narrationSystem: 'Original system',
    narration1: '{background}\n{previousChapters}\n{currentChapter}',
    narration2: '<outline>{textboxInput}</outline>\n{writingStyle}\nEnd after the final outline beat.' },
};
const book: Book = {
  bookId: 'b1', name: 'Book', templateId: 't1', segmentSummaries: [],
  chapters: [{ id: 'c1', title: 'Past', summary: 'They grew up.' }],
  storySegments: [
    { id: 'prior', day: 0, role: 'assistant', content: 'John meets Bob.' },
    { id: 'source', day: 0, role: 'user', content: 'Saved direction' },
    { id: 'replace', day: 0, role: 'assistant', content: 'Prose being redone.' },
  ],
  longTermMemory: { ...createEmptyLongTermMemoryState(), content: {
    schemaVersion: 1, entries: { john: { category: 'character', title: 'John', attributes: { appearance: 'Tall' } } },
  } },
};

describe('narration requests', () => {
  it('matches the legacy assembled Full outline request exactly with memory and a redo boundary', () => {
    const outline = 'John confronts Bob. They reconcile.';
    const context = _promptUtil.craftBookPrompt(template.promptBuilder.narration1, template, book, 'replace', true);
    const input = _promptUtil.craftBookPrompt(template.promptBuilder.narration2, template, book, 'replace', true, { textboxInput: outline });
    const expected = {
      feature: 'narration', systemMessage: appendLongTermMemorySystemInstruction(template.promptBuilder.narrationSystem, book.longTermMemory),
      messages: [{ role: 'user', content: [appendLongTermMemoryToNarrationContext(context, book.longTermMemory), input].filter(Boolean).join('\n\n') }],
      logContext: { feature: 'Narration', bookId: 'b1', bookName: 'Book' },
    };
    expect(createNarrationRequest(template, book, outline, 'replace')).toEqual(expected);
    expect(createNarrationRequest(template, book, outline, 'replace', 'outline')).toEqual(expected);
  });

  it.each<NarrationMode>(['startEnd', 'startOnly', 'events'])('uses the %s defaults, shared context, style, and creative memory label', mode => {
    const direction = 'John confronts Bob. They reconcile.';
    const request = createNarrationRequest(template, book, direction, 'replace', mode);
    const { systemField } = narrationModes[mode];
    expect(request.feature).toBe('narration');
    expect(request.systemMessage).toContain(defaultNarrationModePrompts[systemField as keyof typeof defaultNarrationModePrompts]);
    expect(request.systemMessage).toContain('current SEGMENT DIRECTION');
    expect(request.systemMessage).not.toContain('current OUTLINE');
    expect(request.messages[0].content).toContain(direction);
    expect(request.messages[0].content).toContain(template.writingStyle);
    expect(request.messages[0].content).toContain('John meets Bob.');
    expect(request.messages[0].content).toContain('Tall');
    expect(request.messages[0].content).not.toContain('Prose being redone.');
    expect(request.messages[0].content).not.toContain('End after the final outline beat.');
    expect(request.messages[0].content).toContain('Write 500 to 700 words');
  });

  it('honors a custom mode pair and renders textboxInput and writingStyle', () => {
    const configured = { ...template, promptBuilder: { ...template.promptBuilder,
      narrationEventsSystem: 'Custom event system', narrationEventsRequest: '{textboxInput}\n{writingStyle}' } };
    const request = createNarrationRequest(configured, { ...book, longTermMemory: createEmptyLongTermMemoryState() }, 'Unlabeled events', 'replace', 'events');
    expect(request.systemMessage).toBe('Custom event system');
    expect(request.messages[0].content).toContain(`Unlabeled events\n${template.writingStyle}`);
  });

  it('preserves a null legacy system prompt when memory is empty', () => {
    expect(createNarrationRequest({ ...template, promptBuilder: { ...template.promptBuilder, narrationSystem: null } },
      { ...book, longTermMemory: createEmptyLongTermMemoryState() }, 'Outline', null).systemMessage).toBeNull();
  });
});
