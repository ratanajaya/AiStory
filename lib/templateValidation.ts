import _util from '@/utils/_util';

type TemplateNarrativeFieldsResult =
  | { ok: true; value: { storyBackground: string; writingStyle: string; starterOutline: string } }
  | { ok: false; message: string };

export function validateTemplateNarrativeFields(input: unknown): TemplateNarrativeFieldsResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Template data is required.' };
  }

  const candidate = input as { storyBackground?: unknown; writingStyle?: unknown; starterOutline?: unknown };
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

  if (candidate.starterOutline != null && typeof candidate.starterOutline !== 'string') {
    return { ok: false, message: 'Starter Outline must be a string.' };
  }
  const starterOutline = _util.toInputString(candidate.starterOutline as string | null | undefined);
  return { ok: true, value: { storyBackground, writingStyle, starterOutline } };
}
