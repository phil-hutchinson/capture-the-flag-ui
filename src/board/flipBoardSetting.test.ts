import { afterEach, describe, expect, it } from "vitest";
import {
  readFlipBetweenTurns,
  writeFlipBetweenTurns,
} from "./flipBoardSetting.ts";

/** A minimal in-memory stand-in for the `localStorage` global. */
function inMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

/** A stub whose methods always throw, simulating a blocked local storage. */
function throwingLocalStorage(): Storage {
  const throwError = () => {
    throw new Error("local storage blocked");
  };
  return {
    getItem: throwError,
    setItem: throwError,
    removeItem: throwError,
    clear: throwError,
    key: throwError,
    get length(): number {
      throw new Error("local storage blocked");
    },
  };
}

describe("flipBoardSetting", () => {
  afterEach(() => {
    // @ts-expect-error - deleting a global that may or may not exist.
    delete globalThis.localStorage;
  });

  it("round-trips false", () => {
    globalThis.localStorage = inMemoryLocalStorage();
    writeFlipBetweenTurns(false);
    expect(readFlipBetweenTurns()).toBe(false);
  });

  it("round-trips true", () => {
    globalThis.localStorage = inMemoryLocalStorage();
    writeFlipBetweenTurns(true);
    expect(readFlipBetweenTurns()).toBe(true);
  });

  it("defaults to true when nothing is stored", () => {
    globalThis.localStorage = inMemoryLocalStorage();
    expect(readFlipBetweenTurns()).toBe(true);
  });

  it("defaults to true and does not throw when localStorage is undefined", () => {
    // @ts-expect-error - deleting a global that may or may not exist.
    delete globalThis.localStorage;
    expect(readFlipBetweenTurns()).toBe(true);
    expect(() => writeFlipBetweenTurns(false)).not.toThrow();
  });

  it("defaults to true and does not throw when localStorage throws", () => {
    globalThis.localStorage = throwingLocalStorage();
    expect(readFlipBetweenTurns()).toBe(true);
    expect(() => writeFlipBetweenTurns(false)).not.toThrow();
  });
});
