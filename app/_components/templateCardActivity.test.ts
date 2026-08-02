import { describe, expect, it } from 'vitest';
import { HomepageBook, HomepageTemplate, sortTemplatesByBookActivity } from './templateCardActivity';

const template = (templateId: string, updatedAt?: string): HomepageTemplate => ({
  templateId,
  name: templateId,
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
  storyBackground: '',
  writingStyle: '',
  imageUrl: null,
  ownerEmail: 'owner@example.com',
  updatedAt,
});

const book = (templateId: string, options: Partial<HomepageBook> = {}): HomepageBook => ({
  bookId: `${templateId}-book`,
  name: null,
  templateId,
  ...options,
});

describe('sortTemplatesByBookActivity', () => {
  it('uses a newer segment timestamp when the book metadata is stale', () => {
    const templates = [template('metadata'), template('segment')];
    const books = [
      book('metadata', { updatedAt: '2025-01-02T00:00:00.000Z' }),
      book('segment', {
        updatedAt: '2025-01-01T00:00:00.000Z',
        storySegments: [{ id: '1735862400000' }],
      }),
    ];

    expect(sortTemplatesByBookActivity(templates, books).map(({ templateId }) => templateId))
      .toEqual(['segment', 'metadata']);
  });

  it('uses newer valid book metadata when it is newer than its segments', () => {
    const templates = [template('segment'), template('metadata')];
    const books = [
      book('segment', { storySegments: [{ id: '1735862400000' }] }),
      book('metadata', {
        updatedAt: '2025-01-04T00:00:00.000Z',
        storySegments: [{ id: '1735862400000' }],
      }),
    ];

    expect(sortTemplatesByBookActivity(templates, books).map(({ templateId }) => templateId))
      .toEqual(['metadata', 'segment']);
  });

  it('falls back to a timestamp-based segment id when metadata is invalid', () => {
    const templates = [template('invalid'), template('older')];
    const books = [
      book('invalid', { updatedAt: 'not-a-date', storySegments: [{ id: '1736035200000' }] }),
      book('older', { updatedAt: '2025-01-03T00:00:00.000Z' }),
    ];

    expect(sortTemplatesByBookActivity(templates, books).map(({ templateId }) => templateId))
      .toEqual(['invalid', 'older']);
  });

  it('uses template metadata when none of its books has usable activity', () => {
    const templates = [
      template('older-template', '2025-01-01T00:00:00.000Z'),
      template('newer-template', '2025-01-05T00:00:00.000Z'),
    ];
    const books = [book('older-template', { updatedAt: 'invalid' })];

    expect(sortTemplatesByBookActivity(templates, books).map(({ templateId }) => templateId))
      .toEqual(['newer-template', 'older-template']);
  });

  it('preserves the original order for equal or unavailable activity timestamps', () => {
    const templates = [template('first'), template('second'), template('third')];
    const books = [
      book('first', { updatedAt: '2025-01-01T00:00:00.000Z' }),
      book('second', { updatedAt: '2025-01-01T00:00:00.000Z' }),
    ];

    expect(sortTemplatesByBookActivity(templates, books).map(({ templateId }) => templateId))
      .toEqual(['first', 'second', 'third']);
  });
});
