// Split without dropping punctuation/whitespace or breaking UTF-16 surrogate pairs.
export function splitSpeechInput(input: string, maxCharacters = 4096): string[] {
  if (maxCharacters < 2) throw new Error('Speech chunk size must be at least two characters.');
  const chunks: string[] = [];
  let remaining = input;
  while (remaining.length > maxCharacters) {
    let end = maxCharacters;
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;
    const window = remaining.slice(0, end);
    const sentence = [...window.matchAll(/[.!?。！？](?:\s+|$)/gu)].at(-1);
    const whitespace = [...window.matchAll(/\s+/gu)].at(-1);
    const boundary = sentence ?? whitespace;
    if (boundary?.index !== undefined) end = boundary.index + boundary[0].length;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function pcmToWav(chunks: ArrayBuffer[]): ArrayBuffer {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  if (!length || chunks.some(chunk => chunk.byteLength % 2)) throw new Error('Invalid PCM audio.');
  const output = new ArrayBuffer(44 + length);
  const view = new DataView(output);
  const bytes = new Uint8Array(output);
  const label = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  label(0, 'RIFF'); view.setUint32(4, length + 36, true); label(8, 'WAVE'); label(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, length, true);
  let offset = 44;
  for (const chunk of chunks) { bytes.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; }
  return output;
}
