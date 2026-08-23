import { describe, expect, it } from "vitest";
import { PRE_RELEASE_EDITION_ID, rulesetTag } from "./edition.ts";

describe("edition identity (ruleset major 3)", () => {
  it("names the one proposed edition exactly as rules.md's Appendix spells it", () => {
    expect(PRE_RELEASE_EDITION_ID).toBe("3-0:PRE-RELEASE");
  });

  it("renders the Ruleset tag as a bare edition id, with no deviating tokens", () => {
    expect(rulesetTag()).toBe(PRE_RELEASE_EDITION_ID);
    expect(rulesetTag()).toBe("3-0:PRE-RELEASE");
  });
});
