export type AsyncMapLike<T, U> = {
  get: (key: T) => U | Promise<U> | undefined;
  set: (key: T, value: U) => unknown | Promise<unknown>;
};

export type RememberPromiseOptions<
  T extends (...args: any[]) => Promise<any> = (...args: any[]) => Promise<any>,
  U extends Awaited<ReturnType<T>> = Awaited<ReturnType<T>>,
> = {
  /**
   * Configures how long in milliseconds the cached result should be used before needing to be revalidated.
   * Additionally, setting this value to zero or a negative number will disable caching.
   *
   * **NOTE: the actual revalidation of the cached result is done slightly before expiry by
   * default. This can be adjusted using the {@link xfetchBeta} option.**
   *
   * By default this is `Infinity` so the cached result will be used indefinitely.
   *
   * @default Infinity
   */
  ttl?: number;
  /**
   * This enables stale-while-revalidate behavior where an expired result can still
   * be used while waiting for it to be updated in the background asynchronously.
   *
   * By default this is set to `true` so the behavior is enabled.
   *
   * @default true
   */
  allowStale?: boolean;
  /**
   * This is where cached results will be stored. It can be anything you want such as [lru-cache](https://github.com/isaacs/node-lru-cache)
   * or a redis backed cache as long as it implements a `get` and `set` method defined in the {@link AsyncMapLike} type.
   *
   * By default this is a new instance of [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).
   *
   * @default new Map()
   */
  cache?: AsyncMapLike<
    string,
    {
      result: U;
      lastUpdated: number;
      xfetchDelta: number;
    }
  >;
  /**
   * Identical behavior to the `cacheKey` option in [p-memoize](https://github.com/sindresorhus/p-memoize#cachekey) except that
   * it's allowed to return a promise. It should return what the cache key is based on the parameters of the given function.
   *
   * By default this will serialize all arguments using `JSON.stringify`.
   *
   * @default (...args) => JSON.stringify(args)
   */
  getCacheKey?: (...args: Parameters<T>) => string | Promise<string>;
  /**
   * Use this to catch errors when attempting to update the cache or if `shouldIgnoreResult` throws an error.
   *
   * By default this is `undefined` which means any errors will be rethrown as an unhandled promise rejection.
   *
   * @default undefined
   */
  onCacheUpdateError?: (err: unknown) => unknown;
  /**
   * Determines whether the returned result should be added to the cache.
   *
   * By default this is `undefined` which means it will always use the returned result for caching.
   *
   * @default undefined
   */
  shouldIgnoreResult?: (
    result: U,
    args: Parameters<T>,
  ) => boolean | Promise<boolean>;
  /**
   * This is the beta value used in [optimal probabilistic cache stampede prevention](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf)
   * where values more than 1 favors earlier revalidation while values less than 1 favors later revalidation.
   *
   * By default this is set to 1 so the revalidation of a cached result will happen at a random time slightly before expiry.
   * **If you wish to opt-out of this behavior, then set this value to 0.**
   *
   * @default 1
   */
  xfetchBeta?: number;
};

/**
 * Utility to remember promises that were made by a given function.
 *
 * @param promiseFn Promise-returning or async function to remember.
 * @param {RememberPromiseOptions} options Various options to configure the behavior of this utility.
 */
export const rememberPromise = <
  T extends (...args: any[]) => Promise<any>,
  U extends Awaited<ReturnType<T>>,
>(
  promiseFn: T,
  {
    ttl = Infinity,
    allowStale = true,
    cache = new Map(),
    getCacheKey = (...args) => JSON.stringify(args),
    onCacheUpdateError,
    shouldIgnoreResult,
    xfetchBeta = 1,
  }: RememberPromiseOptions<T, U> = {},
) => {
  const updatePromises = new Map<string, Promise<U>>();

  let shouldUpdate: (lastUpdated: number, xfetchDelta: number) => boolean;
  if (!Number.isFinite(ttl)) {
    shouldUpdate = (lastUpdated) => !lastUpdated;
  } else if (ttl > 0) {
    shouldUpdate = (lastUpdated, xfetchDelta) =>
      Date.now() - xfetchDelta * xfetchBeta * Math.log(Math.random()) >
      lastUpdated + ttl;
  } else {
    shouldUpdate = () => true;
  }

  return async (...args: Parameters<T>): Promise<U> => {
    const cacheKey = await getCacheKey(...args);
    const cacheValue = await cache.get(cacheKey);

    if (
      !cacheValue ||
      shouldUpdate(cacheValue.lastUpdated, cacheValue.xfetchDelta)
    ) {
      let updatePromise = updatePromises.get(cacheKey);

      if (!updatePromise) {
        const startTime = Date.now();

        updatePromise = promiseFn(...args);
        updatePromises.set(cacheKey, updatePromise);

        updatePromise.then(async (result) => {
          try {
            const ignoredResult = shouldIgnoreResult
              ? await shouldIgnoreResult(result, args)
              : false;

            if (!ignoredResult) {
              const lastUpdated = Date.now();

              await cache.set(cacheKey, {
                result,
                lastUpdated,
                xfetchDelta: lastUpdated - startTime,
              });
            }
          } catch (e) {
            if (onCacheUpdateError) {
              onCacheUpdateError(e);
            } else {
              throw e;
            }
          } finally {
            updatePromises.delete(cacheKey);
          }
        });
      }

      if (!allowStale || !cacheValue) {
        return updatePromise;
      }
    }

    return cacheValue.result;
  };
};
