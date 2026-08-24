import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, Template } from '@/types';
import { createEmptyLongTermMemoryState } from './bookMemory';

const chatObjectFull = vi.fn();

vi.mock('@/lib/aiEndpointDynamic', () => ({
  getDynamicAiEndpoint: vi.fn(async () => ({
    endpoint: { chatObjectFull },
    generationProfiles: {
      longTermMemory: { temperature: null, maxOutputTokens: 2000, timeoutMs: 120000, maxRetries: 1 },
    },
  })),
}));

import {
  fingerprintAssistantSegments,
  generateLongTermMemoryProposal,
  MemoryGenerationError,
} from './bookMemoryGeneration';

const template: Template = {
  templateId: 'template-1',
  name: 'Template',
  promptBuilder: {
    narration1: null,
    narration2: null,
    narrationSystem: null,
    enhancer: null,
    enhancerSystem: null,
    segmentSummarizer: null,
    segmentSummarizerSystem: null,
    chapterSummarizer: null,
    chapterSummarizerSystem: null,
    outlineIdeaGenerator: null,
    outlineIdeaGeneratorSystem: null,
  },
  storyBackground: 'A coastal city.',
  writingStyle: 'Close third person.',
  imageUrl: null,
  ownerEmail: 'owner@example.com',
};

const createBook = (): Book => ({
  bookId: 'book-1',
  name: 'Book',
  templateId: template.templateId!,
  storySegments: [
    { id: 'u1', day: 0, role: 'user', content: 'Outline is not canon source.' },
    { id: 'a1', day: 0, role: 'assistant', content: 'Mara wears a red coat.' },
  ],
  segmentSummaries: [],
  chapters: [],
  longTermMemory: createEmptyLongTermMemoryState(),
  ownerEmail: 'owner@example.com',
});

describe('long-term memory proposal generation', () => {
  beforeEach(() => chatObjectFull.mockReset());

  it('allows a sparse initial character profile with only one supported attribute', async () => {
    chatObjectFull.mockResolvedValue({
      operations: [{
        op: 'add',
        path: '/entries/character:mara',
        value: { category: 'character', title: 'Mara', attributes: { appearance: 'Red coat' } },
      }],
    });

    const proposal = await generateLongTermMemoryProposal({ book: createBook(), template, mode: 'incremental' });
    expect(proposal.operations).toEqual([expect.objectContaining({ op: 'add', path: '/entries/character:mara' })]);
    expect(proposal.source.throughSegmentId).toBe('a1');
    const systemPrompt = chatObjectFull.mock.calls[0][0] as string;
    expect(systemPrompt).toContain('stable character profiles');
    expect(systemPrompt).toContain('Generated attributes are optional');
    expect(systemPrompt).toContain('Do not force appearance, personality, or speechStyle');
    expect(systemPrompt).toContain('Exclude relationships and relationship changes');
    expect(systemPrompt).toContain('injuries and scars even when permanent');
    const messages = chatObjectFull.mock.calls[0][1] as Array<{ content: string }>;
    expect(messages[0].content).toContain('A coastal city.');
    expect(messages[0].content).toContain('Mara wears a red coat.');
    expect(messages[0].content).not.toContain('Outline is not canon source.');
    expect(messages[0].content).not.toContain('Close third person.');
    expect(messages[0].content).not.toContain('<writing_style>');
    const schema = chatObjectFull.mock.calls[0][3] as {
      properties: { operations: { items: { properties: { path: { pattern: string } } } } };
    };
    const pathPattern = new RegExp(schema.properties.operations.items.properties.path.pattern);
    expect(pathPattern.test('/entries/character:mara')).toBe(true);
    expect(pathPattern.test('/entries/character:mara/attributes/appearance')).toBe(true);
    expect(pathPattern.test('/entries/')).toBe(false);
  });

  it('supports an incremental proposal that cleans legacy fields while preserving profile facts', async () => {
    const book = createBook();
    const processed = book.storySegments.filter((segment) => segment.role === 'assistant');
    book.longTermMemory = {
      ...createEmptyLongTermMemoryState(),
      revision: 3,
      content: {
        schemaVersion: 1,
        entries: {
          'character:mara': {
            category: 'character',
            title: 'Mara',
            attributes: {
              appearance: 'Red coat',
              relationships: 'Jon is her ally',
              history: 'Arrived after the harbor fire',
            },
          },
          'location:harbor': {
            category: 'location',
            title: 'Harbor',
            attributes: { state: 'Damaged by fire' },
          },
        },
      },
      checkpoint: {
        throughSegmentId: 'a1',
        fingerprint: fingerprintAssistantSegments(processed),
      },
    };
    book.storySegments.push({ id: 'a2', day: 0, role: 'assistant', content: 'Mara waits in silence.' });
    chatObjectFull.mockResolvedValue({
      operations: [
        {
          op: 'replace',
          path: '/entries/character:mara/attributes',
          value: { appearance: 'Red coat' },
        },
        { op: 'remove', path: '/entries/location:harbor' },
      ],
    });

    const proposal = await generateLongTermMemoryProposal({ book, template, mode: 'incremental' });

    expect(proposal.operations).toEqual(expect.arrayContaining([
      { op: 'remove', path: '/entries/character:mara/attributes/history' },
      { op: 'remove', path: '/entries/character:mara/attributes/relationships' },
      { op: 'remove', path: '/entries/location:harbor' },
    ]));
    expect(proposal.operations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/entries/character:mara/attributes/appearance' }),
    ]));
    const systemPrompt = chatObjectFull.mock.calls[0][0] as string;
    expect(systemPrompt).toContain('first clean the working memory');
    expect(systemPrompt).toContain('removing non-character entries');
  });

  it('rejects incremental generation when processed prose changed', async () => {
    const book = createBook();
    book.longTermMemory = {
      ...createEmptyLongTermMemoryState(),
      revision: 2,
      checkpoint: { throughSegmentId: 'a1', fingerprint: 'stale' },
    };

    await expect(generateLongTermMemoryProposal({ book, template, mode: 'incremental' }))
      .rejects.toEqual(expect.objectContaining<Partial<MemoryGenerationError>>({ status: 409 }));
    expect(chatObjectFull).not.toHaveBeenCalled();
  });

  it('returns an empty patch while advancing over source that adds no durable facts', async () => {
    const book = createBook();
    const processed = book.storySegments.filter((segment) => segment.role === 'assistant');
    book.longTermMemory.checkpoint = {
      throughSegmentId: 'a1',
      fingerprint: fingerprintAssistantSegments(processed),
    };
    book.storySegments.push({ id: 'a2', day: 0, role: 'assistant', content: 'Rain continues.' });
    chatObjectFull.mockResolvedValue({ operations: [] });

    const proposal = await generateLongTermMemoryProposal({ book, template, mode: 'incremental' });
    expect(proposal.operations).toEqual([]);
    expect(proposal.source.throughSegmentId).toBe('a2');
  });

  it('fails safely when structured model output contains an invalid patch', async () => {
    chatObjectFull.mockResolvedValue({ operations: [{ op: 'replace', path: '/schemaVersion', value: 2 }] });
    await expect(generateLongTermMemoryProposal({ book: createBook(), template, mode: 'full' }))
      .rejects.toEqual(expect.objectContaining<Partial<MemoryGenerationError>>({ status: 502 }));
  });

  it('rejects an AI operation with an empty entry id and reports the offending operation', async () => {
    chatObjectFull.mockResolvedValue({
      operations: [{
        op: 'add',
        path: '/entries/',
        value: { category: 'character', title: 'Mara', attributes: {} },
      }],
    });

    await expect(generateLongTermMemoryProposal({ book: createBook(), template, mode: 'full' }))
      .rejects.toMatchObject({
        status: 502,
        message: expect.stringContaining('Patch operation 1 has an invalid path'),
      });
  });
});
