import { describe, expect, it } from 'vitest';
import {
  parseChapter,
  parseBookDraft,
  parseSegmentIds,
  parseSegmentSummary,
  parseStorySegment,
} from '@/lib/bookMutationValidation';

describe('book mutation validation', () => {
  it('normalizes draft direction and ignores legacy idea and unrelated fields', () => {
    expect(parseBookDraft({ draftOutline: '  ', draftIdea: 'Legacy', chapters: [] })).toEqual({ draftOutline: '' });
    expect(parseBookDraft({ draftOutline: '  Keep spacing\n' })).toEqual({ draftOutline: '  Keep spacing\n' });
    expect(parseBookDraft({ draftOutline: 'x'.repeat(65_536) })).not.toBeNull();
  });

  it.each([null, [], {}, { draftOutline: false }, { draftOutline: 'x'.repeat(65_537) }])('rejects invalid draft payloads', value => {
    expect(parseBookDraft(value)).toBeNull();
  });
  it.each(['outline', 'startEnd', 'startOnly', 'events'])('preserves the %s mode on source segments', narrationMode => {
    expect(parseStorySegment({ id: 'source', day: 0, role: 'user', content: 'Direction', narrationMode }))
      .toEqual({ id: 'source', day: 0, role: 'user', content: 'Direction', narrationMode });
  });

  it.each(['unknown', '', null, 1, {}])('rejects invalid narration mode metadata: %j', narrationMode => {
    expect(parseStorySegment({ id: 'source', day: 0, role: 'user', content: 'Direction', narrationMode })).toBeNull();
  });

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
