import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbConnect: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  fingerprint: vi.fn(() => 'source-hash'),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/mongodb', () => ({ default: mocks.dbConnect }));
vi.mock('@/models', () => ({
  BookModel: {
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));
vi.mock('@/lib/bookMemoryGeneration', () => ({ fingerprintAssistantSegments: mocks.fingerprint }));

import { PATCH, PUT } from './route';

const params = { params: Promise.resolve({ id: 'book-1' }) };
const jsonRequest = (method: string, body: unknown) => new Request('http://localhost/api/books/book-1/memory', {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const queryResult = <T>(value: T) => {
  const promise = Promise.resolve(value) as Promise<T> & { select: ReturnType<typeof vi.fn> };
  promise.select = vi.fn().mockResolvedValue(value);
  return promise;
};

const document = () => ({
  _id: 'mongo-id',
  updatedAt: new Date('2026-08-18T00:00:00.000Z'),
  storySegments: [{ id: 'a1', day: 0, role: 'assistant', content: 'Accepted prose' }],
  longTermMemory: {
    ...createEmptyLongTermMemoryState(),
    revision: 2,
    checkpoint: { throughSegmentId: null, fingerprint: null },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { email: 'owner@example.com' } });
  mocks.dbConnect.mockResolvedValue(undefined);
});

describe('book memory route', () => {
  it('returns 401 before accessing data when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await PUT(jsonRequest('PUT', {}), params);
    expect(response.status).toBe(401);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it('manually saves only memory and preserves its checkpoint', async () => {
    const current = document();
    const next = {
      ...current,
      longTermMemory: {
        content: {
          schemaVersion: 1 as const,
          entries: { prose: { category: 'prose', title: 'Voice', attributes: { tense: 'past' } } },
        },
        revision: 3,
        checkpoint: current.longTermMemory.checkpoint,
        updatedAt: '2026-08-18T01:00:00.000Z',
      },
    };
    mocks.findOne.mockReturnValue(queryResult(current));
    mocks.findOneAndUpdate.mockReturnValue(queryResult(next));

    const response = await PUT(jsonRequest('PUT', {
      baseRevision: 2,
      content: next.longTermMemory.content,
    }), params);

    expect(response.status).toBe(200);
    const [, update] = mocks.findOneAndUpdate.mock.calls[0];
    expect(Object.keys(update.$set)).toEqual(['longTermMemory']);
    expect(update.$set.longTermMemory.checkpoint).toEqual(current.longTermMemory.checkpoint);
  });

  it('atomically accepts a valid patch with an owner and revision filter', async () => {
    const current = document();
    const next = {
      ...current,
      longTermMemory: {
        content: {
          schemaVersion: 1 as const,
          entries: { clue: { category: 'continuity', title: 'Clue', attributes: { status: 'open' } } },
        },
        revision: 3,
        checkpoint: { throughSegmentId: 'a1', fingerprint: 'source-hash' },
        updatedAt: '2026-08-18T01:00:00.000Z',
      },
    };
    mocks.findOne.mockReturnValue(queryResult(current));
    mocks.findOneAndUpdate.mockReturnValue(queryResult(next));

    const response = await PATCH(jsonRequest('PATCH', {
      baseRevision: 2,
      operations: [{
        op: 'add',
        path: '/entries/clue',
        value: { category: 'continuity', title: 'Clue', attributes: { status: 'open' } },
      }],
      source: {
        mode: 'incremental',
        previousThroughSegmentId: null,
        throughSegmentId: 'a1',
        fingerprint: 'source-hash',
      },
    }), params);

    expect(response.status).toBe(200);
    const [filter, update] = mocks.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual(expect.objectContaining({ _id: 'mongo-id', ownerEmail: 'owner@example.com' }));
    expect(update.$set.longTermMemory.content.entries.clue.title).toBe('Clue');
    expect(update.$set).not.toHaveProperty('storySegments');
  });

  it('rejects a proposal when its analyzed source fingerprint is stale', async () => {
    mocks.findOne.mockReturnValue(queryResult(document()));
    const response = await PATCH(jsonRequest('PATCH', {
      baseRevision: 2,
      operations: [],
      source: {
        mode: 'full',
        previousThroughSegmentId: null,
        throughSegmentId: 'a1',
        fingerprint: 'old-hash',
      },
    }), params);

    expect(response.status).toBe(409);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
