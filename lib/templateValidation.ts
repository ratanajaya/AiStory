import _util from '@/utils/_util';

type TemplateNarrativeFieldsResult =
  | { ok: true; value: { storyBackground: string; writingStyle: string } }
  | { ok: false; message: string };

export function validateTemplateNarrativeFields(input: unknown): TemplateNarrativeFieldsResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Template data is required.' };
  }

  const candidate = input as { storyBackground?: unknown; writingStyle?: unknown };
  const storyBackground = typeof candidate.storyBackground === 'string'
    ? _util.toInputString(candidate.storyBackground)
    : '';
  const writingStyle = typeof candidate.writingStyle === 'string'
    ? _util.toInputString(candidate.writingStyle)
    : '';

  if (!storyBackground) {
    return { ok: false, message: 'Story Background cannot be empty.' };
  }
  if (!writingStyle) {
    return { ok: false, message: 'Writing Style cannot be empty.' };
  }

  return { ok: true, value: { storyBackground, writingStyle } };
}
