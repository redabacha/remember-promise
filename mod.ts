// deno-lint-ignore-file no-explicit-any

/**
 * @module
 *
 * This is the main module for the {@link rememberPromise} utility.
 *
 * Usage:
 * ```js
 * import { rememberPromise } from "remember-promise";
 *
 * const getRedditFeed = rememberPromise(
 *   (subreddit) =>
 *     fetch(`https://www.reddit.com/r/${subreddit}.json`).then((res) =>
 *       res.json()
 *     ),
 *   {
 *     ttl: 300_000, // 5 minutes before the result must be revalidated again
 *   },
 * );
 *
 * const firstResult = await getRedditFeed("all");
 * const secondResult = await getRedditFeed("all"); // this call is cached
 * ```
 */

/** Describes the structure of each item in the cache of the {@link rememberPromise} utility. */
export interface RememberPromiseCacheItem<Result> {
  /** Stores the time the promise took to return the last updated value. */
  duration: number;
  /** Stores the time of when the promise was cached. */
  lastUpdated: number;
  /** Stores the return value of the promise. */
  result: Result;
}

/** Methods required for a cache to be used with the {@link rememberPromise} utility. */
export interface RememberPromiseCache<
  Key,
  Result,
  Item = RememberPromiseCacheItem<Result>,
> {
  /** Retrieves an item for a given key which can optionally be an asynchronous operation. */
  get: (key: Key) => Item | Promise<Item> | undefined;
  /** Stores an item for a given key which can optionally be an asynchronous operation. */
  set: (key: Key, item: Item) => unknown | Promise<unknown>;
}

/** Various options to configure the behavior of the {@link rememberPromise} utility. */
export interface RememberPromiseOptions<
  PromiseFn extends (...args: any[]) => Promise<any> = (
    ...args: any[]
  ) => Promise<any>,
  Result extends Awaited<ReturnType<PromiseFn>> = Awaited<
    ReturnType<PromiseFn>
  >,
  CacheKey = string,
> {
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
   * If you would like to disable caching and only deduplicate identical concurrent calls instead then set this to `false`.
   * When this is set to `false`, the `onCacheUpdateError` and `shouldIgnoreResult` options will be never be used.
   *
   * By default this is a new instance of [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).
   *
   * @default new Map()
   */
  cache?: RememberPromiseCache<CacheKey, Result> | false;
  /**
   * Identical behavior to the `cacheKey` option in [p-memoize](https://github.com/sindresorhus/p-memoize#cachekey) except that
   * it's allowed to return a promise. It should return what the cache key is based on the parameters of the given function.
   *
   * By default this will serialize all arguments using `JSON.stringify`.
   *
   * @default (...args) => JSON.stringify(args)
   */
  getCacheKey?: (
    ...args: Parameters<PromiseFn>
  ) => CacheKey | Promise<CacheKey>;
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
    result: Result,
    args: Parameters<PromiseFn>,
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
}

/**
 * Utility to remember promises that were made by a given function.
 *
 * @param promiseFn Promise-returning or async function to remember.
 * @param {RememberPromiseOptions} options Various options to configure the behavior of this utility.
 */
export function rememberPromise<
  PromiseFn extends (...args: any[]) => Promise<any>,
  Result extends Awaited<ReturnType<PromiseFn>>,
  CacheKey = string,
>(
  promiseFn: PromiseFn,
  options: RememberPromiseOptions<PromiseFn, Result, CacheKey> = {},
): (...args: Parameters<PromiseFn>) => Promise<Result> {
  const {
    ttl = Infinity,
    allowStale = true,
    cache = new Map<CacheKey, RememberPromiseCacheItem<Result>>(),
    getCacheKey = (...args) => JSON.stringify(args) as CacheKey,
    onCacheUpdateError,
    shouldIgnoreResult,
    xfetchBeta = 1,
  } = options;
  const updatePromises = new Map<CacheKey, Promise<Result>>();

  let shouldUpdate: (lastUpdated: number, duration: number) => boolean;
  if (!Number.isFinite(ttl)) {
    shouldUpdate = (lastUpdated) => !lastUpdated;
  } else if (ttl > 0) {
    shouldUpdate = (lastUpdated, duration) =>
      Date.now() - duration * xfetchBeta * Math.log(Math.random()) >
        lastUpdated + ttl;
  } else {
    shouldUpdate = () => true;
  }

  return async (...args: Parameters<PromiseFn>): Promise<Result> => {
    const cacheKey = await getCacheKey(...args);
    const cacheValue = cache && await cache.get(cacheKey);

    if (
      !cacheValue ||
      shouldUpdate(cacheValue.lastUpdated, cacheValue.duration)
    ) {
      let updatePromise = updatePromises.get(cacheKey);

      if (!updatePromise) {
        updatePromise = promiseFn(...args);
        updatePromises.set(cacheKey, updatePromise);

        let cacheUpdatePromise: Promise<void> = updatePromise;

        if (cache) {
          const startTime = Date.now();

          cacheUpdatePromise = updatePromise.then(async (result) => {
            try {
              const ignoredResult = shouldIgnoreResult
                ? await shouldIgnoreResult(result, args)
                : false;

              if (!ignoredResult) {
                const lastUpdated = Date.now();

                await cache.set(cacheKey, {
                  duration: lastUpdated - startTime,
                  lastUpdated,
                  result,
                });
              }
            } catch (e) {
              if (onCacheUpdateError) {
                onCacheUpdateError(e);
              } else {
                throw e;
              }
            }
          });
        }

        cacheUpdatePromise.then(() => {
          updatePromises.delete(cacheKey);
        });
      }

      if (!allowStale || !cacheValue) {
        return updatePromise;
      }
    }

    return cacheValue.result;
  };
}
