import { describe, expect, it } from 'vitest';
import {
  parseChapter,
  parseSegmentIds,
  parseSegmentSummary,
  parseStorySegment,
} from '@/lib/bookMutationValidation';

describe('book mutation validation', () => {
  it('accepts a complete story segment and its supported optional fields', () => {
    expect(parseStorySegment({
      id: 'segment-1',
      day: 1,
      role: 'assistant',
      content: 'Story text',
      toSummarize: true,
      narrationModel: { service: 'openAi', model: 'gpt-5' },
    })).toEqual({
      id: 'segment-1',
      day: 1,
      role: 'assistant',
      content: 'Story text',
      toSummarize: true,
      narrationModel: { service: 'openAi', model: 'gpt-5' },
    });
  });

  it('rejects malformed segments and unsupported field types', () => {
    expect(parseStorySegment({ id: 'segment-1', day: '1', role: 'assistant', content: 'Story text' })).toBeNull();
    expect(parseStorySegment({ id: 'segment-1', day: 1, role: 'assistant', content: 'Story text', toSummarize: 'yes' })).toBeNull();
    expect(parseStorySegment({ id: 'segment-1', day: 1, role: 'assistant', content: 'Story text', narrationModel: { service: 'openAi', model: ' ' } })).toBeNull();
    expect(parseStorySegment({ id: 'segment-1', day: 1, role: 'assistant', content: 'Story text', narrationModel: { service: 'unknown', model: 'model-1' } })).toBeNull();
  });

  it('treats null model metadata as unavailable on older segments', () => {
    expect(parseStorySegment({
      id: 'segment-1', day: 1, role: 'assistant', content: 'Story text', narrationModel: null,
    })).toEqual({ id: 'segment-1', day: 1, role: 'assistant', content: 'Story text' });
  });

  it('requires unique nonempty segment ids for atomic assignments', () => {
    expect(parseSegmentIds(['segment-1', 'segment-2'])).toEqual(['segment-1', 'segment-2']);
    expect(parseSegmentIds(['segment-1', 'segment-1'])).toBeNull();
    expect(parseSegmentIds(['segment-1', ''])).toBeNull();
  });

  it('validates summary and chapter payloads without accepting blank titles', () => {
    expect(parseSegmentSummary({ id: 'summary-1', content: '' })).toEqual({ id: 'summary-1', content: '' });
    expect(parseChapter({ id: 'chapter-1', title: 'Chapter One', summary: 'A recap' })).toEqual({
      id: 'chapter-1',
      title: 'Chapter One',
      summary: 'A recap',
    });
    expect(parseChapter({ id: 'chapter-1', title: ' ', summary: 'A recap' })).toBeNull();
  });
});
