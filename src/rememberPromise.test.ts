import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberPromise } from './rememberPromise.js';

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

  it('should not call promiseFn again if ttl is set and not expired', async () => {
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

describe('onCacheUpdateError', () => {
  describe('onCacheUpdateError is undefined', () => {
    it('should throw separately if errors occurred while updating cache', async () => {
      let updateCacheFn;
      const promise = Promise.resolve('call');
      const promiseThenSpy = vi
        .spyOn(promise, 'then')
        .mockImplementationOnce(updateCache => {
          updateCacheFn = updateCache;
          return Promise.resolve();
        });
      const cachedPromiseFn = rememberPromise(() => promise, {
        shouldIgnoreResult: () => {
          throw new Error('test');
        },
      });

      expect(await cachedPromiseFn()).toBe('call');
      expect(promiseThenSpy).toHaveBeenCalledTimes(2);
      await expect(updateCacheFn()).rejects.toThrowError(new Error('test'));
    });

    it('should throw separately if errors occurred while calling shouldIgnoreResult', async () => {
      let updateCacheFn;
      const promise = Promise.resolve('call');
      const promiseThenSpy = vi
        .spyOn(promise, 'then')
        .mockImplementationOnce(updateCache => {
          updateCacheFn = updateCache;
          return Promise.resolve();
        });
      const cachedPromiseFn = rememberPromise(() => promise, {
        shouldIgnoreResult: () => {
          throw new Error('test');
        },
      });

      expect(await cachedPromiseFn()).toBe('call');
      expect(promiseThenSpy).toHaveBeenCalledTimes(2);
      await expect(updateCacheFn()).rejects.toThrowError(new Error('test'));
    });
  });

  describe('onCacheUpdateError is not undefined', () => {
    it('should call onCacheUpdateError if errors occurred while updating cache', async () => {
      let updateCacheFn;
      const onCacheUpdateError = vi.fn();
      const promise = Promise.resolve('call');
      const promiseThenSpy = vi
        .spyOn(promise, 'then')
        .mockImplementationOnce(updateCache => {
          updateCacheFn = updateCache;
          return Promise.resolve();
        });
      const cachedPromiseFn = rememberPromise(() => promise, {
        onCacheUpdateError,
        shouldIgnoreResult: () => {
          throw new Error('test');
        },
      });

      expect(await cachedPromiseFn()).toBe('call');
      expect(promiseThenSpy).toHaveBeenCalledTimes(2);
      await expect(updateCacheFn()).resolves.toBeUndefined();
      expect(onCacheUpdateError).toHaveBeenCalledTimes(1);
      expect(onCacheUpdateError).toHaveBeenCalledWith(new Error('test'));
    });

    it('should call onCacheUpdateError if errors occurred while calling shouldIgnoreResult', async () => {
      let updateCacheFn;
      const onCacheUpdateError = vi.fn();
      const promise = Promise.resolve('call');
      const promiseThenSpy = vi
        .spyOn(promise, 'then')
        .mockImplementationOnce(updateCache => {
          updateCacheFn = updateCache;
          return Promise.resolve();
        });
      const cachedPromiseFn = rememberPromise(() => promise, {
        onCacheUpdateError,
        shouldIgnoreResult: () => {
          throw new Error('test');
        },
      });

      expect(await cachedPromiseFn()).toBe('call');
      expect(promiseThenSpy).toHaveBeenCalledTimes(2);
      await expect(updateCacheFn()).resolves.toBeUndefined();
      expect(onCacheUpdateError).toHaveBeenCalledTimes(1);
      expect(onCacheUpdateError).toHaveBeenCalledWith(new Error('test'));
    });
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
