import { expect, it } from 'vitest';
import { parseReleaseFiles, parseAudioRange, releaseSnapshot, RELEASE_MAX_BYTES } from '@/lib/releaseValidation';
it('copies only nonempty saved assistant text in order and omits editor data', () => {
  const book = { name: ' Book ', storySegments: [
    { id: 'u', role: 'user', content: 'secret prompt', day: 1 },
    { id: 'a2', role: 'assistant', content: 'Second', day: 9, chapterId: 'private', narrationModel: { service: 'openAi' as const, model: 'secret' } },
    { id: 'a1', role: 'assistant', content: 'First', day: 2 }, { id: 'e', role: 'assistant', content: '  ', day: 2 },
  ] };
  const copy = releaseSnapshot(book);
  expect(copy.title).toBe('Book');
  expect(copy.segments).toEqual([{ id: 'a2', content: 'Second', expectedAudioParts: 1, audio: [] }, { id: 'a1', content: 'First', expectedAudioParts: 1, audio: [] }]);
  expect(releaseSnapshot({ ...book, storySegments: book.storySegments.map(s => s.id === 'u' ? { ...s, content: 'different prompt' } : s) }).fingerprint).toBe(copy.fingerprint);
  expect(releaseSnapshot({ ...book, name: 'Other' }).fingerprint).not.toBe(copy.fingerprint);
  expect(releaseSnapshot({ ...book, name: null }).title).toBe('Untitled');
});
const segment = { id: 's', content: 'A', expectedAudioParts: 3, audio: [] };
const file = { segmentId: 's', partIndex: 1, whole: false, mimeType: 'audio/mpeg', byteSize: 100 };
it('accepts partial ordered references and whole legacy recordings', () => {
  expect(parseReleaseFiles({ files: [file] }, [segment])).toEqual([file]);
  expect(parseReleaseFiles({ files: [{ ...file, partIndex: 0, whole: true }] }, [segment])).toHaveLength(1);
  expect(parseReleaseFiles({ files: [] }, [segment])).toEqual([]);
});
it.each([null, [], { files: 'bad' }, { files: [file, file] }, { files: [{ ...file, segmentId: 'forged' }] },
  { files: [{ ...file, partIndex: 3 }] }, { files: [{ ...file, partIndex: -1 }] }, { files: [{ ...file, mimeType: 'text/html' }] },
  { files: [{ ...file, byteSize: 0 }] }, { files: [{ ...file, byteSize: RELEASE_MAX_BYTES + 1 }] },
  { files: [{ ...file, whole: true }] }, { files: [{ ...file, partIndex: 0, whole: true }, file] },
])('rejects invalid manifests %j', body => expect(parseReleaseFiles(body, [segment])).toBeNull());
it.each([['bytes=0-9', { start: 0, end: 9 }], ['bytes=50-', { start: 50, end: 99 }], ['bytes=-20', { start: 80, end: 99 }],
  ['bytes=0-999', { start: 0, end: 99 }], ['bytes=100-', false], ['bytes=10-5', false], ['bytes=0-1,5-8', false], ['bytes=-0', false], ['bytes=-', false], ['other', false], [null, null],
])('validates range %s', (header, expected) => expect(parseAudioRange(header as string | null, 100)).toEqual(expected));
