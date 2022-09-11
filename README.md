# remember-promise

[![npm](https://shields.io/npm/v/remember-promise)](https://www.npmjs.com/package/remember-promise)
[![license](https://shields.io/github/license/redabacha/remember-promise)](https://github.com/redabacha/remember-promise/blob/main/LICENSE)

A simple utility to remember promises that were made! It is greatly inspired by the [p-memoize](https://github.com/sindresorhus/p-memoize) utility but with additional built-in features and changes such as:

- stale-while-revalidate behavior
- ttl expiry
- [optimal probabilistic cache stampede prevention](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf)
- ability to ignore results from being cached
- zero dependencies, commonjs and guaranteed browser support!

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

```ts
import { rememberPromise } from 'remember-promise';

const getAllRedditFeed = rememberPromise(() =>
  fetch('https://www.reddit.com/r/all.json').then(res => res.json())
);

const firstResult = await getAllRedditFeed();
const secondResult = await getAllRedditFeed(); // this call is cached
```

## Options

| Name                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ttl`                | Configures how long in milliseconds the cached result should be used before needing to be revalidated. **NOTE: the actual revalidation of the cached result is done slightly before expiry by default. This can be adjusted using the `xfetchBeta` option.** By default, the cached result will be used indefinitely. Additionally, setting this value to a negative number will disable caching.                                                  |
| `allowStale`         | This enables stale-while-revalidate behavior where an expired result can still be used while waiting for it to be updated in the background asynchronously. By default, this behavior is enabled.                                                                                                                                                                                                                                                  |
| `cache`              | This is where cached results will be stored. It can be anything you want such as [lru-cache](https://github.com/isaacs/node-lru-cache) or a redis backed cache as long as it implements a `get` and `set` method. By default, this is an instance of [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).                                                                                                  |
| `getCacheKey`        | Identical behavior to the `cacheKey` option in [p-memoize](https://github.com/sindresorhus/p-memoize#cachekey). It should return what the cache key based on the parameters of given promise function. By default, this will serialize all arguments using `JSON.stringify`.                                                                                                                                                                       |
| `onCacheUpdateError` | Use this to catch errors caught when attempting to update the cache or if `shouldIgnoreResult` throws an error.                                                                                                                                                                                                                                                                                                                                    |
| `shouldIgnoreResult` | Determines whether the returned result should be added to the cache. By default, this is `undefined` meaning it will always use the returned result for caching.                                                                                                                                                                                                                                                                                   |
| `xfetchBeta`         | This is the beta value used in [optimal probabilistic cache stampede prevention](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf) where values more than 1 favors earlier revalidation while values less than 1 favors later revalidation. By default, this is set to 1 so revalidation of a cached result will happen at a random time slightly before expiry. **If you wish to opt-out of this behavior, then set this value to 0.** |
