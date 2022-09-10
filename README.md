# remember-promise

A simple utility to rememeber promises that were made! It is greatly inspired by the [p-memoize](https://github.com/sindresorhus/p-memoize) utility but with additional built-in features and changes such as:

- stale-while-revalidate behavior
- ttl expiry
- [optimal probabilistic cache stampede prevention](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf)
- ability to ignore results from being cached
- zero dependencies, commonjs and guaranteed browser support!

## Usage

```ts
import { rememberPromise } from 'remember-promise';

const getAllRedditFeed = rememberPromise(() =>
  fetch('https://www.reddit.com/r/all.json').then(res => res.json())
);

const firstResult = await getAllRedditFeed();
const secondResult = await getAllRedditFeed(); // this call is cached
```
