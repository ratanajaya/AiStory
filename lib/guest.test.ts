import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ GuestWorkspaceModel: {}, UserModel: {} }));

import { decryptGuestKey, encryptGuestKey } from './guest';

const previous = process.env.GUEST_KEY_ENCRYPTION_SECRET;
afterEach(() => { if (previous === undefined) delete process.env.GUEST_KEY_ENCRYPTION_SECRET; else process.env.GUEST_KEY_ENCRYPTION_SECRET = previous; });

describe('guest key encryption', () => {
  it('encrypts with a random IV and rejects tampering', () => {
    process.env.GUEST_KEY_ENCRYPTION_SECRET = 'test-only-secret';
    const first = encryptGuestKey('personal-provider-key');
    const second = encryptGuestKey('personal-provider-key');
    expect(first).not.toBe(second);
    expect(first).not.toContain('personal-provider-key');
    expect(decryptGuestKey(first)).toBe('personal-provider-key');
    expect(() => decryptGuestKey(first.slice(0, -2) + 'ab')).toThrow();
  });
});
