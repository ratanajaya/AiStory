import { describe, expect, it } from 'vitest';
import {
  STREAM_ERROR_SENTINEL,
  buildStreamErrorTail,
  splitStreamPayload,
} from './streamProtocol';

describe('splitStreamPayload', () => {
  it('returns the full body as content when no sentinel is present', () => {
    const result = splitStreamPayload('Once upon a time, in a kingdom far away.');
    expect(result.content).toBe('Once upon a time, in a kingdom far away.');
    expect(result.error).toBeUndefined();
  });

  it('extracts both the content and the error envelope when a sentinel is present', () => {
    const tail = buildStreamErrorTail(new Error('upstream 401'));
    const result = splitStreamPayload('partial story...' + tail);
    expect(result.content).toBe('partial story...');
    expect(result.error?.message).toBe('upstream 401');
    expect(result.error?.name).toBe('Error');
    expect(result.error?.stack).toBeTruthy();
  });

  it('returns empty content when only the sentinel + envelope is present', () => {
    const tail = buildStreamErrorTail(new Error('nothing was generated'));
    const result = splitStreamPayload(tail);
    expect(result.content).toBe('');
    expect(result.error?.message).toBe('nothing was generated');
  });

  it('falls back to a malformed-envelope error when the JSON after the sentinel is invalid', () => {
    const malformed = 'content' + STREAM_ERROR_SENTINEL + '{this is not json';
    const result = splitStreamPayload(malformed);
    expect(result.content).toBe('content');
    expect(result.error?.message).toBe('Malformed error envelope from server');
    expect(result.error?.stack).toContain('{this is not json');
  });
});

describe('buildStreamErrorTail', () => {
  it('serializes a thrown Error to a sentinel-prefixed JSON envelope', () => {
    const tail = buildStreamErrorTail(new Error('boom'));
    expect(tail.startsWith(STREAM_ERROR_SENTINEL)).toBe(true);
    const json = tail.slice(STREAM_ERROR_SENTINEL.length);
    const env = JSON.parse(json);
    expect(env.message).toBe('boom');
    expect(env.name).toBe('Error');
  });

  it('handles string throws', () => {
    const tail = buildStreamErrorTail('plain string error');
    const env = JSON.parse(tail.slice(STREAM_ERROR_SENTINEL.length));
    expect(env.message).toBe('plain string error');
  });

  it('handles plain object throws by JSON-stringifying them', () => {
    const tail = buildStreamErrorTail({ provider: 'mistral', status: 401 });
    const env = JSON.parse(tail.slice(STREAM_ERROR_SENTINEL.length));
    expect(env.message).toContain('mistral');
    expect(env.message).toContain('401');
  });
});
