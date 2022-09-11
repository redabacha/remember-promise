import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberPromise } from './rememberPromise.js';

declare global {
  const process: { nextTick: () => void };
}

const createMockPromiseFn = () => {
  let callCount = 1;
  return vi.fn(async () => {
    vi.setSystemTime(Date.now() + 3000);
    return `call-${callCount++}`;
  });
};

beforeEach(() => {
  vi.useFakeTimers();

  return () => {
    vi.useRealTimers();
  };
});

it('should only call promiseFn once when updating cache', async () => {
  const promiseFn = createMockPromiseFn();
  const cachedPromiseFn = rememberPromise(promiseFn);

  expect(
    await Promise.all([cachedPromiseFn(), cachedPromiseFn()])
  ).toStrictEqual(['call-1', 'call-1']);
  expect(promiseFn).toHaveBeenCalledTimes(1);
});

describe('ttl', () => {
  it('should never call promiseFn again if ttl is not set', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn);

    await cachedPromiseFn();
    vi.setSystemTime(8640000000000000);
    await cachedPromiseFn();

    expect(promiseFn).toHaveBeenCalledTimes(1);
  });

  it('should call promiseFn again if ttl is set and expired', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, { ttl: 30_000 });

    await cachedPromiseFn();
    vi.setSystemTime(Date.now() + 30_001);
    await cachedPromiseFn();

    expect(promiseFn).toHaveBeenCalledTimes(2);
  });

  it('should not call promiseFn if ttl is set and not expired', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, { ttl: 30_000 });

    await cachedPromiseFn();
    vi.setSystemTime(Date.now() + 1);
    await cachedPromiseFn();

    expect(promiseFn).toHaveBeenCalledTimes(1);
  });
});

describe('allowStale', () => {
  it('should return previous cached result while updating cache after ttl expired and allowStale is true', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      allowStale: true,
      ttl: 30_000,
    });

    expect(await cachedPromiseFn()).toBe('call-1');
    vi.setSystemTime(Date.now() + 30_001);
    expect(await cachedPromiseFn()).toBe('call-1');
    await new Promise(process.nextTick); // wait for cache to update
    expect(await cachedPromiseFn()).toBe('call-2');
    expect(promiseFn).toHaveBeenCalledTimes(2);
  });

  it('should not return previous cached result while updating cache after ttl expired and allowStale is false', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      allowStale: false,
      ttl: 30_000,
    });

    expect(await cachedPromiseFn()).toBe('call-1');
    vi.setSystemTime(Date.now() + 30_001);
    expect(await cachedPromiseFn()).toBe('call-2');
    expect(promiseFn).toHaveBeenCalledTimes(2);
  });
});

describe('getCacheKey', () => {
  it('should use the same cached result if getCacheKey returns the same key', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      getCacheKey: () => '',
    });

    expect(await cachedPromiseFn()).toBe('call-1');
    expect(await cachedPromiseFn()).toBe('call-1');
    expect(promiseFn).toHaveBeenCalledTimes(1);
  });

  it('should not use the same cached result if getCacheKey returns a different key', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      getCacheKey: vi.fn(() => 'default').mockReturnValueOnce('first'),
    });

    expect(await cachedPromiseFn()).toBe('call-1');
    expect(await cachedPromiseFn()).toBe('call-2');
    expect(promiseFn).toHaveBeenCalledTimes(2);
  });
});

describe('shouldIgnoreResult', () => {
  it('should update cache if shouldIgnoreResult returns false', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      shouldIgnoreResult: result => result !== 'call-1',
      ttl: -1, // forces shouldUpdate to always return true
    });

    expect(await cachedPromiseFn()).toBe('call-1');
    expect(await cachedPromiseFn()).toBe('call-1');
    expect(promiseFn).toHaveBeenCalledTimes(2);
  });

  it('should not update cache if shouldIgnoreResult returns true', async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      shouldIgnoreResult: result => result === 'call-1',
      ttl: -1,
    });

    expect(await cachedPromiseFn()).toBe('call-1');
    expect(await cachedPromiseFn()).toBe('call-2');
    expect(promiseFn).toHaveBeenCalledTimes(2);
  });
});
