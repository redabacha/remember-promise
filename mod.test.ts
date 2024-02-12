import {
  assertEquals,
  assertIsError,
} from "https://deno.land/std@0.215.0/assert/mod.ts";
import {
  afterEach,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.215.0/testing/bdd.ts";
import {
  assertSpyCalls,
  returnsNext,
  spy,
  stub,
} from "https://deno.land/std@0.215.0/testing/mock.ts";
import { FakeTime } from "https://deno.land/std@0.215.0/testing/time.ts";
import { rememberPromise } from "./mod.ts";

const createMockPromiseFn = () => {
  let callCount = 1;
  return spy(() => Promise.resolve(`call-${callCount++}`));
};

let time: FakeTime;

beforeEach(() => {
  time = new FakeTime();
});

afterEach(() => {
  time.restore();
});

it("should throttle calls to promiseFn", async () => {
  const promiseFn = createMockPromiseFn();
  const cachedPromiseFn = rememberPromise(promiseFn);

  assertEquals(await Promise.all([cachedPromiseFn(), cachedPromiseFn()]), [
    "call-1",
    "call-1",
  ]);
  assertSpyCalls(promiseFn, 1);
});

describe("ttl", () => {
  it("should never call promiseFn again if ttl is not set", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn);

    await cachedPromiseFn();
    time.now = 8640000000000000;
    await cachedPromiseFn();

    assertSpyCalls(promiseFn, 1);
  });

  it("should call promiseFn again if ttl is set and expired", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, { ttl: 30_000 });

    await cachedPromiseFn();
    time.now += 30_001;
    await cachedPromiseFn();

    assertSpyCalls(promiseFn, 2);
  });

  it("should not call promiseFn again if ttl is set and not expired", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, { ttl: 30_000 });

    await cachedPromiseFn();
    time.now += 1;
    await cachedPromiseFn();

    assertSpyCalls(promiseFn, 1);
  });
});

describe("allowStale", () => {
  it("should return previous cached result while updating cache after ttl expired and allowStale is true", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      allowStale: true,
      ttl: 30_000,
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    time.now += 30_001;
    assertEquals(await cachedPromiseFn(), "call-1");
    assertEquals(await cachedPromiseFn(), "call-2");
    assertSpyCalls(promiseFn, 2);
  });

  it("should not return previous cached result while updating cache after ttl expired and allowStale is false", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      allowStale: false,
      ttl: 30_000,
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    time.now += 30_001;
    assertEquals(await cachedPromiseFn(), "call-2");
    assertSpyCalls(promiseFn, 2);
  });
});

describe("cache", () => {
  it("should not call onCacheUpdateError or shouldIgnoreResult if cache is set to false", async () => {
    const onCacheUpdateErrorSpy = spy(() => {});
    const shouldIgnoreResultSpy = spy(() => false);
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      cache: false,
      onCacheUpdateError: onCacheUpdateErrorSpy,
      shouldIgnoreResult: shouldIgnoreResultSpy,
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    assertSpyCalls(promiseFn, 1);
    assertSpyCalls(onCacheUpdateErrorSpy, 0);
    assertSpyCalls(shouldIgnoreResultSpy, 0);
  });
});

describe("getCacheKey", () => {
  it("should use the same cached result if getCacheKey returns the same key", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      getCacheKey: () => "",
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    assertEquals(await cachedPromiseFn(), "call-1");
    assertSpyCalls(promiseFn, 1);
  });

  it("should not use the same cached result if getCacheKey returns a different key", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      getCacheKey: stub(
        { getCacheKey: () => "default" },
        "getCacheKey",
        returnsNext(["first", "second"]),
      ),
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    assertEquals(await cachedPromiseFn(), "call-2");
    assertSpyCalls(promiseFn, 2);
  });
});

describe("onCacheUpdateError", () => {
  describe("onCacheUpdateError is undefined", () => {
    it("should throw unhandled rejection if errors occurred while updating cache", async () => {
      const cache = new Map();
      const cacheSetStub = stub(cache, "set", () => {
        throw new Error("test");
      });
      const unhandledRejectionReasonPromise = new Promise((resolve) => {
        const listener = (event: PromiseRejectionEvent) => {
          globalThis.removeEventListener("unhandledrejection", listener);
          event.preventDefault();
          resolve(event.reason);
        };
        globalThis.addEventListener("unhandledrejection", listener);
      });
      const promiseFn = createMockPromiseFn();
      const cachedPromiseFn = rememberPromise(promiseFn, { cache });

      assertEquals(await cachedPromiseFn(), "call-1");
      assertSpyCalls(promiseFn, 1);
      assertSpyCalls(cacheSetStub, 1);
      assertIsError(await unhandledRejectionReasonPromise, Error, "test");
    });

    it("should throw unhandled rejection if errors occurred while calling shouldIgnoreResult", async () => {
      const shouldIgnoreResultSpy = spy(() => {
        throw new Error("test");
      });
      const unhandledRejectionReasonPromise = new Promise((resolve) => {
        const listener = (event: PromiseRejectionEvent) => {
          globalThis.removeEventListener("unhandledrejection", listener);
          event.preventDefault();
          resolve(event.reason);
        };
        globalThis.addEventListener("unhandledrejection", listener);
      });
      const promiseFn = createMockPromiseFn();
      const cachedPromiseFn = rememberPromise(promiseFn, {
        shouldIgnoreResult: shouldIgnoreResultSpy,
      });

      assertEquals(await cachedPromiseFn(), "call-1");
      assertSpyCalls(promiseFn, 1);
      assertSpyCalls(shouldIgnoreResultSpy, 1);
      assertIsError(await unhandledRejectionReasonPromise, Error, "test");
    });
  });

  describe("onCacheUpdateError is defined", () => {
    it("should call onCacheUpdateError if errors occurred while updating cache", async () => {
      const cache = new Map();
      const cacheSetStub = stub(cache, "set", () => {
        throw new Error("test");
      });
      const onCacheUpdateErrorSpy = spy((_error: unknown) => {});
      const promiseFn = createMockPromiseFn();
      const cachedPromiseFn = rememberPromise(promiseFn, {
        cache,
        onCacheUpdateError: onCacheUpdateErrorSpy,
      });

      assertEquals(await cachedPromiseFn(), "call-1");
      assertSpyCalls(promiseFn, 1);
      assertSpyCalls(cacheSetStub, 1);
      assertSpyCalls(onCacheUpdateErrorSpy, 1);
      assertIsError(onCacheUpdateErrorSpy.calls[0].args[0], Error, "test");
    });

    it("should call onCacheUpdateError if errors occurred while calling shouldIgnoreResult", async () => {
      const shouldIgnoreResultSpy = spy(() => {
        throw new Error("test");
      });
      const onCacheUpdateErrorSpy = spy((_error: unknown) => {});
      const promiseFn = createMockPromiseFn();
      const cachedPromiseFn = rememberPromise(promiseFn, {
        shouldIgnoreResult: shouldIgnoreResultSpy,
        onCacheUpdateError: onCacheUpdateErrorSpy,
      });

      assertEquals(await cachedPromiseFn(), "call-1");
      assertSpyCalls(promiseFn, 1);
      assertSpyCalls(shouldIgnoreResultSpy, 1);
      assertSpyCalls(onCacheUpdateErrorSpy, 1);
      assertIsError(onCacheUpdateErrorSpy.calls[0].args[0], Error, "test");
    });
  });
});

describe("shouldIgnoreResult", () => {
  it("should update cache if shouldIgnoreResult returns false", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      shouldIgnoreResult: (result) => result !== "call-1",
      ttl: 0,
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    assertEquals(await cachedPromiseFn(), "call-1");
    assertSpyCalls(promiseFn, 2);
  });

  it("should not update cache if shouldIgnoreResult returns true", async () => {
    const promiseFn = createMockPromiseFn();
    const cachedPromiseFn = rememberPromise(promiseFn, {
      shouldIgnoreResult: (result) => result === "call-1",
      ttl: 0,
    });

    assertEquals(await cachedPromiseFn(), "call-1");
    assertEquals(await cachedPromiseFn(), "call-2");
    assertSpyCalls(promiseFn, 2);
  });
});
