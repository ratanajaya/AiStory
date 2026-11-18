import { NextRequest } from 'next/server';
import { expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));
vi.mock('@/lib/authSessionOverride', () => ({
  getAuthSessionOverrideUser: () => null,
}));

import middleware from '@/middleware';

const origin = 'http://localhost:7002';
async function call(path: string, headers: Record<string, string> = {}, method = 'PATCH') {
  const request = new NextRequest(`${origin}${path}`, {
    method,
    headers: { origin, cookie: 'aistory_guest=guest-token', ...headers },
  });
  const response = await middleware(request, { params: Promise.resolve({}) });
  if (!response) throw new Error('Expected a middleware response');
  return response;
}

it.each(['books', 'templates'])('lets guest %s status requests reach their actor-aware handler', async kind => {
  const response = await call(`/api/${kind}/item-1/status`);
  expect(response.status).toBe(200);
  expect(response.headers.get('x-middleware-next')).toBe('1');
});

it.each(['books', 'templates'])('rejects cross-origin guest %s status requests', async kind => {
  const response = await call(`/api/${kind}/item-1/status`, { origin: 'https://other.example' });
  expect(response.status).toBe(403);
});

it.each(['books', 'templates'])('rejects cross-site guest %s status requests', async kind => {
  const response = await call(`/api/${kind}/item-1/status`, { 'sec-fetch-site': 'cross-site' });
  expect(response.status).toBe(403);
});

it.each([
  '/api/settings',
  '/api/books/item-1/release',
  '/api/release-attempts/attempt-1/commit',
  '/api/books/item-1/status/extra',
  '/api/templates/item-1/status/extra',
])('keeps %s protected from requests without an account session', async path => {
  const response = await call(path);
  expect(response.status).toBe(401);
});

it('lets guest autocomplete reach its handler and blocks cross-site requests', async () => {
  const guest = await call('/api/ai/autocomplete', {}, 'POST');
  expect(guest.headers.get('x-middleware-next')).toBe('1');
  const rejected = await call('/api/ai/autocomplete', { 'sec-fetch-site': 'cross-site' }, 'POST');
  expect(rejected.status).toBe(403);
});
