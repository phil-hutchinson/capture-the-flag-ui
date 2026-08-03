import { describe, expect, it } from "vitest";
import { editionById } from "../rules/primary/v2/edition.ts";
import { boardSizeDescription, defaultGameId, gameName } from "./gameNames.ts";

describe("gameName", () => {
  it("names 2-0:BATTLE as Battle", () => {
    expect(gameName(editionById("2-0:BATTLE"))).toBe("Battle");
  });

  it("names 2-0:SKIRMISH as Skirmish", () => {
    expect(gameName(editionById("2-0:SKIRMISH"))).toBe("Skirmish");
  });
});

describe("boardSizeDescription", () => {
  it("describes Battle's 12x12 board", () => {
    expect(boardSizeDescription(editionById("2-0:BATTLE"))).toBe(
      "a 12x12 board",
    );
  });

  it("describes Skirmish's 8x8 board with an 'an' article", () => {
    expect(boardSizeDescription(editionById("2-0:SKIRMISH"))).toBe(
      "an 8x8 board",
    );
  });
});

describe("defaultGameId (which game GameChoice pre-selects)", () => {
  it("is Skirmish on the first game of a session, when nothing has been played yet", () => {
    expect(defaultGameId(null)).toBe("2-0:SKIRMISH");
  });

  it("is Battle after a Battle game was just played", () => {
    expect(defaultGameId(editionById("2-0:BATTLE"))).toBe("2-0:BATTLE");
  });

  it("is Skirmish after a Skirmish game was just played", () => {
    expect(defaultGameId(editionById("2-0:SKIRMISH"))).toBe("2-0:SKIRMISH");
  });
});
