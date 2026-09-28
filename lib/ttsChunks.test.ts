import { describe, expect, it } from 'vitest';
import { splitTtsText } from '@/lib/ttsChunks';

describe('paragraph speech chunks', () => {
  it('keeps paragraphs separate, preserves soft line breaks, and ignores empty paragraphs', () => {
    expect(splitTtsText(' \r\n\r\nFirst\r\nline.\r\n \r\nSecond.\r\n\r\n')).toEqual(['First\r\nline.', 'Second.']);
    expect(splitTtsText(' \n\n\t')).toEqual([]);
  });
  it('uses the same 2000-character rule for the first and all subsequent paragraphs', () => {
    const text = 'x'.repeat(2000);
    expect(splitTtsText(`${text}\n\n${text}`)).toEqual([text, text]);
    expect(splitTtsText('x'.repeat(6001)).map(chunk => chunk.length)).toEqual([2000, 2000, 2000, 1]);
  });
  it('prefers a sentence boundary, then whitespace, without losing spoken content', () => {
    const input = 'First sentence. Second sentence is longer than the limit.';
    const parts = splitTtsText(input, 25);
    expect(parts[0]).toBe('First sentence.');
    expect(parts.every(part => part.length <= 25)).toBe(true);
    expect(parts.join(' ')).toBe(input);
    expect(splitTtsText('one two three', 8)).toEqual(['one two', 'three']);
    expect(splitTtsText('One. Two. Three.', 9)).toEqual(['One. Two.', 'Three.']);
  });
  it('recognizes CJK punctuation even without following whitespace', () => {
    expect(splitTtsText('这是第一句。这里还有很多文字', 10)).toEqual(['这是第一句。', '这里还有很多文字']);
  });
  it('splits unbroken text without breaking a surrogate pair', () => {
    const text = 'x'.repeat(1999) + '😀' + 'y'.repeat(2100);
    const parts = splitTtsText(text);
    expect(parts.join('')).toBe(text);
    expect(parts[0].length).toBe(1999);
    expect(parts.every(part => part.length <= 2000 && !/[\uD800-\uDBFF]$/.test(part) && !/^[\uDC00-\uDFFF]/.test(part))).toBe(true);
  });
});
