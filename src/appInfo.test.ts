import { describe, expect, it } from "vitest";
import { APP_NAME } from "./appInfo.ts";

// A deliberately trivial test: it exists to prove the vitest wiring works in a
// fresh clone of the repository, and will be superseded by real tests as the
// game UI is built out.
describe("appInfo", () => {
  it("names the game", () => {
    expect(APP_NAME).toBe("Capture the Flag");
  });
});
