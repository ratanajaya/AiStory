import { expect, it } from 'vitest';
import { bookStartUrl, createStarterSegments } from './starterOutline';
it('hands off only books with a starter segment', () => {
  expect(bookStartUrl({ bookId: 'b1' })).toBe('/book/b1');
  expect(bookStartUrl({ bookId: 'b1', starterSegmentId: '100' })).toBe('/book/b1?starterSegmentId=100');
});
it('trims an outline like manual submission while retaining line breaks', () => {
  expect(createStarterSegments('  Meet Mara.\nA storm arrives.  ')[0]).toMatchObject({ content: 'Meet Mara.\nA storm arrives.', role: 'user', day: 0 });
});
