import { describe, expect, it } from 'vitest';
import { createBookChatRequest } from '@/lib/bookChatRequest';
import { createNarrationRequest } from '@/lib/narrationRequest';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import type { Book, Template } from '@/types';
import _constant from '@/utils/_constant';

const template = {
  templateId: 'template', name: 'Template', imageUrl: null, storyBackground: 'A port city.', writingStyle: 'Past tense.',
  promptBuilder: { ..._constant.emptyPromptBuilder, narration1: '{background}\n{writingStyle}\n{previousChapters}\n{currentChapter}',
    narrationSystem: 'Write the segment.', narration2: 'Direction: {textboxInput}' },
} satisfies Template;

const book: Book = {
  bookId: 'book', name: 'Book', templateId: template.templateId,
  chapters: [{ id: 'chapter', title: 'Departure', summary: 'Mara leaves the city.' }],
  segmentSummaries: [{ id: 'summary', content: 'Mara joins the crew.' }],
  storySegments: [
    { id: '1', day: 0, role: 'assistant', chapterId: 'chapter', content: 'Full previous chapter' },
    { id: '2', day: 0, role: 'assistant', segmentSummaryId: 'summary', content: 'Summarized prose' },
    { id: '3', day: 0, role: 'assistant', excludeFromPrevStory: true, content: 'Excluded prose' },
    { id: '4', day: 0, role: 'user', content: 'Saved direction' },
    { id: '5', day: 0, role: 'assistant', content: 'The ship reaches an island.' },
  ],
  longTermMemory: {
    ...createEmptyLongTermMemoryState(),
    content: { schemaVersion: 1, entries: { mara: { category: 'character', title: 'Mara', attributes: { skill: 'Navigation' } } } },
  },
};

describe('book chat requests', () => {
  it('sends exactly the shared narration context and uses a conversational system prompt', () => {
    const narration = createNarrationRequest(template, book, 'Make landfall', null);
    const context = narration.messages[0].content.replace(/\n\nDirection: Make landfall$/, '');
    const chat = createBookChatRequest(template, book, 'Review the current story', []);

    expect(chat.feature).toBe('default');
    expect(chat.logContext).toBeUndefined();
    expect(chat.systemMessage).toContain('discussing');
    expect(chat.systemMessage).not.toContain('Write the segment.');
    expect(chat.messages).toEqual([{ role: 'user', content: `<story_context>\n${context}\n</story_context>\n\nReview the current story` }]);
    for (const part of ['A port city.', 'Past tense.', 'Mara leaves the city.', 'Mara joins the crew.', 'The ship reaches an island.', 'Navigation']) {
      expect(context).toContain(part);
    }
    for (const part of ['Full previous chapter', 'Summarized prose', 'Excluded prose', 'Saved direction']) {
      expect(context).not.toContain(part);
    }
  });

  it('uses only saved memory when the narration context is blank', () => {
    const blankTemplate = { ...template, promptBuilder: { ...template.promptBuilder, narration1: '' } };
    const narration = createNarrationRequest(blankTemplate, book, 'Make landfall', null);
    const context = narration.messages[0].content.replace(/\n\nDirection: Make landfall$/, '');
    expect(context).toMatch(/^<long_term_memory>/);
    expect(createBookChatRequest(blankTemplate, book, 'Question', []).messages[0].content)
      .toBe(`<story_context>\n${context}\n</story_context>\n\nQuestion`);

    const emptyBook = { ...book, longTermMemory: createEmptyLongTermMemoryState() };
    expect(createBookChatRequest(blankTemplate, emptyBook, 'Question', []).messages).toEqual([{ role: 'user', content: 'Question' }]);
  });

  it('keeps the full chat history and current question beyond 64 KiB', () => {
    const older = { question: 'Older question', answer: '界'.repeat(22_000) };
    const newest = { question: 'Most recent question', answer: 'Most recent answer' };
    const question = `Follow-up: ${'界'.repeat(22_000)}`;
    const request = createBookChatRequest(template, book, question, [older, newest]);
    expect(request.messages).toEqual([
      { role: 'user', content: older.question },
      { role: 'assistant', content: older.answer },
      { role: 'user', content: newest.question },
      { role: 'assistant', content: newest.answer },
      { role: 'user', content: expect.stringContaining(question) },
    ]);
  });
});
