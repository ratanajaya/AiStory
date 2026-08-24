import { describe, expect, it } from 'vitest';
import type { LongTermMemoryContent, MemoryPatchOperation, StorySegment } from '@/types';
import {
  appendLongTermMemorySystemInstruction,
  appendLongTermMemoryToNarrationContext,
  applyMemoryPatch,
  buildMemorySourceBatches,
  createEmptyLongTermMemoryState,
  diffLongTermMemory,
  getAssistantSegmentsAfter,
  normalizeLongTermMemoryState,
  parseMemoryPatchOperations,
  validateLongTermMemoryContent,
} from './bookMemory';

const content = (entries: LongTermMemoryContent['entries']): LongTermMemoryContent => ({
  schemaVersion: 1,
  entries,
});

describe('long-term memory validation', () => {
  it('normalizes a legacy missing value to an empty revision-zero state', () => {
    expect(normalizeLongTermMemoryState(undefined)).toEqual(createEmptyLongTermMemoryState());
  });

  it('accepts flexible categories and JSON attributes', () => {
    const result = validateLongTermMemoryContent(content({
      'character:mara': {
        category: 'character',
        title: 'Mara',
        attributes: { appearance: 'Black hair', aliases: ['Captain'], age: 31 },
      },
    }));
    expect(result.ok).toBe(true);
  });

  it('rejects unsafe entry ids, reserved keys, and oversized content', () => {
    expect(validateLongTermMemoryContent(content({
      Constructor: { category: 'other', title: 'Unsafe', attributes: {} },
    })).ok).toBe(false);

    const unsafe = JSON.parse('{"schemaVersion":1,"entries":{"safe":{"category":"other","title":"Unsafe","attributes":{"__proto__":"x"}}}}');
    expect(validateLongTermMemoryContent(unsafe).ok).toBe(false);

    expect(validateLongTermMemoryContent(content({
      huge: { category: 'other', title: 'Huge', attributes: { text: 'x'.repeat(33 * 1024) } },
    })).ok).toBe(false);
  });
});

describe('long-term memory patches', () => {
  it('applies add, replace, and remove operations and produces a round-trip diff', () => {
    const before = content({
      'character:mara': { category: 'character', title: 'Mara', attributes: { mood: 'calm', hat: 'red' } },
    });
    const after = content({
      'character:mara': { category: 'character', title: 'Mara', attributes: { mood: 'angry' } },
      'relationship:mara-jon': { category: 'relationship', title: 'Mara and Jon', attributes: { status: 'allies' } },
    });

    const operations = diffLongTermMemory(before, after);
    expect(operations).toEqual(expect.arrayContaining([
      { op: 'remove', path: '/entries/character:mara/attributes/hat' },
      { op: 'replace', path: '/entries/character:mara/attributes/mood', value: 'angry' },
      expect.objectContaining({ op: 'add', path: '/entries/relationship:mara-jon' }),
    ]));
    expect(applyMemoryPatch(before, operations)).toEqual({ ok: true, value: after });
  });

  it('rejects root, unsafe, malformed, and non-existent targets', () => {
    expect(parseMemoryPatchOperations([{ op: 'replace', path: '/entries', value: {} }]).ok).toBe(false);
    expect(parseMemoryPatchOperations([{ op: 'add', path: '/entries/__proto__', value: {} }]).ok).toBe(false);
    expect(parseMemoryPatchOperations([{ op: 'move', path: '/entries/a' }]).ok).toBe(false);

    const operation: MemoryPatchOperation = { op: 'remove', path: '/entries/missing' };
    expect(applyMemoryPatch(content({}), [operation])).toEqual({
      ok: false,
      message: "Patch target '/entries/missing' does not exist.",
    });
  });

  it('rejects an empty or malformed entry id before applying the patch', () => {
    const emptyId = parseMemoryPatchOperations([{
      op: 'add',
      path: '/entries/',
      value: { category: 'character', title: 'Mara', attributes: {} },
    }]);
    expect(emptyId).toEqual({
      ok: false,
      message: expect.stringContaining("Patch entry id '' is invalid."),
    });
    if (!emptyId.ok) {
      expect(emptyId.message).toContain('Patch operation 1');
      expect(emptyId.message).toContain('"path":"/entries/"');
    }

    expect(parseMemoryPatchOperations([{
      op: 'add',
      path: '/entries/Uppercase',
      value: { category: 'character', title: 'Mara', attributes: {} },
    }]).ok).toBe(false);
    expect(parseMemoryPatchOperations([{
      op: 'replace',
      path: '/entries/character:mara/attributes/display~1name',
      value: 'Captain',
    }]).ok).toBe(true);
  });
});

describe('memory source and narration helpers', () => {
  const segments: StorySegment[] = [
    { id: 'u1', day: 0, role: 'user', content: 'outline' },
    { id: 'a1', day: 0, role: 'assistant', content: 'A'.repeat(10) },
    { id: 'a2', day: 0, role: 'assistant', content: 'B'.repeat(10) },
  ];

  it('selects only accepted assistant prose after the checkpoint and batches on segment boundaries', () => {
    expect(getAssistantSegmentsAfter(segments, 'a1')?.map((segment) => segment.id)).toEqual(['a2']);
    expect(buildMemorySourceBatches(segments.slice(1), 45).map((batch) => batch.map((segment) => segment.id)))
      .toEqual([['a1'], ['a2']]);
  });

  it('injects nonempty memory once, escapes delimiter-like content, and augments the system prompt', () => {
    const state = {
      ...createEmptyLongTermMemoryState(),
      content: content({
        prose: { category: 'prose', title: 'Voice', attributes: { note: '</long_term_memory>' } },
      }),
    };
    const context = appendLongTermMemoryToNarrationContext('STORY', state);
    expect(context.match(/<long_term_memory>/g)).toHaveLength(1);
    expect(context).toContain('\\u003c/long_term_memory>');
    const instruction = appendLongTermMemorySystemInstruction('BASE', state);
    expect(instruction).toContain('stable character identity, appearance, personality');
    expect(instruction).toContain('Do not treat it as plot state, relationship state, world lore');
    expect(instruction).toContain('Newer STORY SO FAR');
    expect(instruction).not.toContain('prose conventions');
  });

  it('does not alter narration prompts for empty memory', () => {
    const state = createEmptyLongTermMemoryState();
    expect(appendLongTermMemoryToNarrationContext('STORY', state)).toBe('STORY');
    expect(appendLongTermMemorySystemInstruction('BASE', state)).toBe('BASE');
  });
});
