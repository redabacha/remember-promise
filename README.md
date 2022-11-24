# remember-promise

[![npm](https://shields.io/npm/v/remember-promise)](https://www.npmjs.com/package/remember-promise)
[![license](https://shields.io/github/license/redabacha/remember-promise)](https://github.com/redabacha/remember-promise/blob/main/LICENSE)

A simple utility to remember promises that were made! It is greatly inspired by the [p-memoize](https://github.com/sindresorhus/p-memoize) utility but with additional built-in features and changes such as:

- ttl expiry
- stale-while-revalidate behavior
- ability to ignore results from being cached
- [optimal probabilistic cache stampede prevention](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf)
- zero dependencies + [tiny bundle size](https://bundlephobia.com/package/remember-promise@latest) + commonjs, deno (via [esm.sh](https://esm.sh/remember-promise@latest) or [npm specifiers](https://deno.land/manual/node/npm_specifiers)) and browser support!

## Installation

yarn:

```
yarn add remember-promise
```

npm:

```
npm install remember-promise
```

pnpm:

```
pnpm install remember-promise
```

## Usage

```js
import { rememberPromise } from 'remember-promise';

const getRedditFeed = rememberPromise(
  subreddit =>
    fetch(`https://www.reddit.com/r/${subreddit}.json`).then(res => res.json()),
  {
    ttl: 300_000, // 5 minutes before the result must be revalidated again
    /* see below for a full list of available options */
  }
);

const firstResult = await getRedditFeed('all');
const secondResult = await getRedditFeed('all'); // this call is cached
```

## Options

| Name                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ttl`                | Configures how long in milliseconds the cached result should be used before needing to be revalidated. Additionally, setting this value to a negative number will disable caching. **NOTE: the actual revalidation of the cached result is done slightly before expiry by default. This can be adjusted using the `xfetchBeta` option.** By default this is `undefined` so the cached result will be used indefinitely.                               |
| `allowStale`         | This enables stale-while-revalidate behavior where an expired result can still be used while waiting for it to be updated in the background asynchronously. By default this is set to `true` so the behavior is enabled.                                                                                                                                                                                                                              |
| `cache`              | This is where cached results will be stored. It can be anything you want such as [lru-cache](https://github.com/isaacs/node-lru-cache) or a redis backed cache as long as it implements a `get` and `set` method defined in the `AsyncMapLike` type. By default this is a new instance of [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).                                                                |
| `getCacheKey`        | Identical behavior to the `cacheKey` option in [p-memoize](https://github.com/sindresorhus/p-memoize#cachekey) except that it's allowed to return a promise. It should return what the cache key is based on the parameters of the given function. By default this will serialize all arguments using `JSON.stringify`.                                                                                                                               |
| `onCacheUpdateError` | Use this to catch errors when attempting to update the cache or if `shouldIgnoreResult` throws an error. By default this is `undefined` which means any errors will be rethrown as an unhandled promise rejection.                                                                                                                                                                                                                                    |
| `shouldIgnoreResult` | Determines whether the returned result should be added to the cache. By default this is `undefined` which means it will always use the returned result for caching.                                                                                                                                                                                                                                                                                   |
| `xfetchBeta`         | This is the beta value used in [optimal probabilistic cache stampede prevention](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf) where values more than 1 favors earlier revalidation while values less than 1 favors later revalidation. By default this is set to 1 so the revalidation of a cached result will happen at a random time slightly before expiry. **If you wish to opt-out of this behavior, then set this value to 0.** |
