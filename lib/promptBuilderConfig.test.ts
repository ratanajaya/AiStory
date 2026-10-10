import { describe, expect, it } from 'vitest';
import { mergePromptBuilderWithDefaults, validatePromptBuilderConfig } from '@/lib/promptBuilderConfig';
import { defaultNarrationModePrompts } from '@/lib/narrationModes';

describe('Prompt Builder configuration', () => {
  it('resolves each mode field independently through template, global, and built-in defaults', () => {
    const config = mergePromptBuilderWithDefaults({
      narrationStartEndSystem: 'Template system', narrationStartEndRequest: '  ',
      narrationStartOnlySystem: null, narrationEventsRequest: undefined,
      narrationSystem: 'Existing renderer', narration2: 'Existing outline request',
      outlineIdeaGenerator: 'Legacy generator',
    }, {
      narrationStartEndSystem: 'Global system', narrationStartEndRequest: 'Global request',
      narrationStartOnlySystem: ' ', narrationEventsRequest: 'Global events',
      narration1: 'Shared context', outlineIdeaGeneratorSystem: 'Legacy generator system',
    });
    expect(config).toMatchObject({
      narrationStartEndSystem: 'Template system', narrationStartEndRequest: 'Global request',
      narrationStartOnlySystem: defaultNarrationModePrompts.narrationStartOnlySystem,
      narrationStartOnlyRequest: defaultNarrationModePrompts.narrationStartOnlyRequest,
      narrationEventsRequest: 'Global events', narration1: 'Shared context',
      narrationSystem: 'Existing renderer', narration2: 'Existing outline request',
      outlineIdeaGenerator: 'Legacy generator', outlineIdeaGeneratorSystem: 'Legacy generator system',
    });
  });

  it('supplies all creative modes for old configurations without changing original prompts', () => {
    expect(mergePromptBuilderWithDefaults({ narrationSystem: 'Original', narration2: 'Original request' }))
      .toMatchObject({ ...defaultNarrationModePrompts, narrationSystem: 'Original', narration2: 'Original request' });
    expect(mergePromptBuilderWithDefaults(null)).toMatchObject(defaultNarrationModePrompts);
  });

  it('normalizes unset fields and preserves custom and deprecated prompt values', () => {
    expect(validatePromptBuilderConfig({ narrationEventsSystem: '  ', narrationEventsRequest: null,
      narrationStartEndSystem: 'Custom', outlineIdeaGenerator: 'Legacy', outlineIdeaGeneratorSystem: 'Legacy system' }))
      .toMatchObject({ ok: true, value: { narrationEventsSystem: '', narrationEventsRequest: '',
        narrationStartEndSystem: 'Custom', outlineIdeaGenerator: 'Legacy', outlineIdeaGeneratorSystem: 'Legacy system' } });
    expect(validatePromptBuilderConfig(undefined).ok).toBe(true);
  });

  it.each(Object.keys(defaultNarrationModePrompts))('rejects malformed %s instead of normalizing it', field => {
    expect(validatePromptBuilderConfig({ [field]: { text: 'Not a string' } }).ok).toBe(false);
    expect(validatePromptBuilderConfig({ [field]: 4 }).ok).toBe(false);
  });

  it.each([[], 'prompt', 1])('rejects a non-object config: %j', config => {
    expect(validatePromptBuilderConfig(config).ok).toBe(false);
  });
});
