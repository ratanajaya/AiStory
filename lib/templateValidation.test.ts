import { describe, expect, it } from 'vitest';
import { validateTemplateNarrativeFields } from './templateValidation';

describe('validateTemplateNarrativeFields', () => {
  it('normalizes and accepts required template narrative fields', () => {
    expect(validateTemplateNarrativeFields({
      storyBackground: 'A low-fantasy kingdom.',
      writingStyle: 'Use third-person narration.',
    })).toEqual({
      ok: true,
      value: {
        storyBackground: 'A low-fantasy kingdom.',
        writingStyle: 'Use third-person narration.',
      },
    });
  });

  it('rejects an empty or whitespace-only Story Background', () => {
    expect(validateTemplateNarrativeFields({
      storyBackground: '   ',
      writingStyle: 'Use third-person narration.',
    })).toEqual({ ok: false, message: 'Story Background cannot be empty.' });
  });

  it('rejects an empty or whitespace-only Writing Style', () => {
    expect(validateTemplateNarrativeFields({
      storyBackground: 'A low-fantasy kingdom.',
      writingStyle: '\n\t',
    })).toEqual({ ok: false, message: 'Writing Style cannot be empty.' });
  });
});
