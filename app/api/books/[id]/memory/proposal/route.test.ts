import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbConnect: vi.fn(),
  bookFindOne: vi.fn(),
  templateFindOne: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/mongodb', () => ({ default: mocks.dbConnect }));
vi.mock('@/models', () => ({
  BookModel: { findOne: mocks.bookFindOne },
  TemplateModel: { findOne: mocks.templateFindOne },
}));
vi.mock('@/lib/bookMemoryGeneration', () => ({
  MemoryGenerationError: class MemoryGenerationError extends Error {
    readonly cause?: unknown;

    constructor(message: string, readonly status: number, cause?: unknown) {
      super(message);
      this.name = 'MemoryGenerationError';
      this.cause = cause;
    }
  },
  generateLongTermMemoryProposal: mocks.generate,
}));

import { MemoryGenerationError } from '@/lib/bookMemoryGeneration';
import { POST } from './route';

const params = { params: Promise.resolve({ id: 'book-1' }) };
const request = (body: unknown) => new Request('http://localhost/api/books/book-1/memory/proposal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const leanResult = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: 'owner@example.com' } });
  mocks.dbConnect.mockResolvedValue(undefined);
});

describe('memory proposal route', () => {
  it('requires authentication before querying the book', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request({ mode: 'incremental', baseRevision: 0 }), params);
    expect(response.status).toBe(401);
    expect(mocks.bookFindOne).not.toHaveBeenCalled();
  });

  it('loads both book and template with owner scope and returns a transient proposal', async () => {
    const book = {
      bookId: 'book-1',
      templateId: 'template-1',
      storySegments: [{ id: 'a1', day: 0, role: 'assistant', content: 'Story' }],
      segmentSummaries: [],
      chapters: [],
      longTermMemory: createEmptyLongTermMemoryState(),
      ownerEmail: 'owner@example.com',
    };
    const template = {
      templateId: 'template-1',
      storyBackground: 'Background',
      writingStyle: 'Style',
      ownerEmail: 'owner@example.com',
    };
    const proposal = {
      baseRevision: 0,
      operations: [],
      source: {
        mode: 'incremental',
        previousThroughSegmentId: null,
        throughSegmentId: 'a1',
        fingerprint: 'hash',
      },
    };
    mocks.bookFindOne.mockReturnValue(leanResult(book));
    mocks.templateFindOne.mockReturnValue(leanResult(template));
    mocks.generate.mockResolvedValue(proposal);

    const response = await POST(request({ mode: 'incremental', baseRevision: 0 }), params);
    expect(response.status).toBe(200);
    expect(mocks.bookFindOne).toHaveBeenCalledWith({ bookId: 'book-1', ownerEmail: 'owner@example.com' });
    expect(mocks.templateFindOne).toHaveBeenCalledWith({ templateId: 'template-1', ownerEmail: 'owner@example.com' });
    expect(await response.json()).toEqual(proposal);
  });

  it('rejects a stale base revision before loading the template or calling AI', async () => {
    mocks.bookFindOne.mockReturnValue(leanResult({
      bookId: 'book-1',
      templateId: 'template-1',
      longTermMemory: { ...createEmptyLongTermMemoryState(), revision: 4 },
    }));
    const response = await POST(request({ mode: 'full', baseRevision: 3 }), params);
    expect(response.status).toBe(409);
    expect(mocks.templateFindOne).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('returns the full technical provider error chain to the client', async () => {
    const book = {
      bookId: 'book-1',
      templateId: 'template-1',
      storySegments: [{ id: 'a1', day: 0, role: 'assistant', content: 'Story' }],
      longTermMemory: createEmptyLongTermMemoryState(),
    };
    const providerError = Object.assign(new Error('No output generated.'), {
      name: 'AiStructuredOutputError',
      details: {
        provider: 'togetherai.chat',
        modelId: 'zai-org/GLM-5.2',
        finishReason: 'length',
        usage: { outputTokens: 4096 },
      },
    });
    mocks.bookFindOne.mockReturnValue(leanResult(book));
    mocks.templateFindOne.mockReturnValue(leanResult({
      templateId: 'template-1',
      storyBackground: 'Background',
      writingStyle: 'Style',
    }));
    mocks.generate.mockRejectedValue(new MemoryGenerationError(
      'AI memory patch generation failed for source batch 1/1.',
      502,
      providerError,
    ));

    const response = await POST(request({ mode: 'incremental', baseRevision: 0 }), params);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toMatchObject({
      name: 'MemoryGenerationError',
      message: 'AI memory patch generation failed for source batch 1/1.',
      cause: {
        name: 'AiStructuredOutputError',
        message: 'No output generated.',
        details: {
          provider: 'togetherai.chat',
          modelId: 'zai-org/GLM-5.2',
          finishReason: 'length',
        },
      },
    });
    expect(body.error.stack).toContain('MemoryGenerationError');
  });
});
