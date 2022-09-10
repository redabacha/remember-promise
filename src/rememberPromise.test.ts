import { beforeEach, expect, it, vi } from 'vitest';
import { rememberPromise } from './rememberPromise.js';

beforeEach(() => {
  vi.useFakeTimers();

  return () => {
    vi.useRealTimers();
  };
});

it('should never call promiseFn again if ttl is not set', async () => {
  const promiseFn = vi.fn(async () => {
    /* noop */
  });
  const cachedPromiseFn = rememberPromise(promiseFn);

  await cachedPromiseFn();
  vi.setSystemTime(8640000000000000);
  await cachedPromiseFn();

  expect(promiseFn).toHaveBeenCalledTimes(1);
});

it('should call promiseFn again if ttl is set and expired', async () => {
  const promiseFn = vi.fn(async () => {
    /* noop */
  });
  const cachedPromiseFn = rememberPromise(promiseFn, { ttl: 30_000 });

  await cachedPromiseFn();
  vi.setSystemTime(Date.now() + 30_001);
  await cachedPromiseFn();

  expect(promiseFn).toHaveBeenCalledTimes(2);
});

it('should not call promiseFn if ttl is set and not expired', async () => {
  const promiseFn = vi.fn(async () => {
    /* noop */
  });
  const cachedPromiseFn = rememberPromise(promiseFn, { ttl: 30_000 });

  await cachedPromiseFn();
  vi.setSystemTime(Date.now() + 1);
  await cachedPromiseFn();

  expect(promiseFn).toHaveBeenCalledTimes(1);
});

it('should return previous cached result after ttl expired and allowStale is true', async () => {
  const promiseFn = vi
    .fn(async () => 'default')
    .mockReturnValueOnce(Promise.resolve('first'));
  const cachedPromiseFn = rememberPromise(promiseFn, {
    allowStale: true,
    ttl: 30_000,
  });

  expect(await cachedPromiseFn()).toBe('first');
  vi.setSystemTime(Date.now() + 30_001);
  expect(await cachedPromiseFn()).toBe('first');
});

it('should not return previous cached result after ttl expired and allowStale is false', async () => {
  const promiseFn = vi
    .fn(async () => 'default')
    .mockReturnValueOnce(Promise.resolve('first'));
  const cachedPromiseFn = rememberPromise(promiseFn, {
    allowStale: false,
    ttl: 30_000,
  });

  expect(await cachedPromiseFn()).toBe('first');
  vi.setSystemTime(Date.now() + 30_001);
  expect(await cachedPromiseFn()).toBe('default');
});

it('should only call promiseFn once when updating cache', async () => {
  const promiseFn = vi
    .fn(async () => 'default')
    .mockReturnValueOnce(Promise.resolve('first'));
  const cachedPromiseFn = rememberPromise(promiseFn);

  expect(
    await Promise.all([cachedPromiseFn(), cachedPromiseFn()])
  ).toStrictEqual(['first', 'first']);
  expect(promiseFn).toHaveBeenCalledTimes(1);
});

it('should not update cache if shouldIgnoreResult returns true', async () => {
  const promiseFn = vi
    .fn(async () => 'default')
    .mockReturnValueOnce(Promise.resolve('first'));
  const cachedPromiseFn = rememberPromise(promiseFn, {
    shouldIgnoreResult: result => result === 'first',
  });

  expect(await cachedPromiseFn()).toBe('first');
  expect(await cachedPromiseFn()).toBe('default');
  expect(await cachedPromiseFn()).toBe('default');
  expect(promiseFn).toHaveBeenCalledTimes(2);
});
