import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from './createId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Gives crypto random bytes but no randomUUID, to force the fallback path. */
function withoutRandomUUID(): void {
  const realCrypto = globalThis.crypto;
  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint8Array) => realCrypto.getRandomValues(array),
  });
}

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a valid v4 UUID in a secure context', () => {
    expect(createId()).toMatch(UUID_V4);
  });

  it('falls back to a valid v4 UUID when randomUUID is unavailable', () => {
    withoutRandomUUID();

    expect('randomUUID' in globalThis.crypto).toBe(false);
    expect(createId()).toMatch(UUID_V4);
  });

  it('produces unique values through the fallback', () => {
    withoutRandomUUID();

    const ids = new Set(Array.from({ length: 500 }, () => createId()));

    expect(ids.size).toBe(500);
  });

  it('does not use Math.random in the fallback', () => {
    withoutRandomUUID();
    const mathRandom = vi.spyOn(Math, 'random');

    createId();

    expect(mathRandom).not.toHaveBeenCalled();
  });
});
