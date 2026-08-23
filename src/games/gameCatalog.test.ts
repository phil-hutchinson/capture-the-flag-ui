import { describe, expect, it } from "vitest";
import { boardSizeDescription } from "../board/gameNames.ts";
import { buildGameConfiguration } from "../rules/primary/v2/games.ts";
import {
  APP_GAME_IDS,
  GAME_CATALOG,
  offeredGames,
  ruleChoicesFromConfiguration,
  type AppGameId,
} from "./gameCatalog.ts";

describe("GAME_CATALOG", () => {
  it("is exhaustive over AppGameId", () => {
    expect(Object.keys(GAME_CATALOG).sort()).toEqual([...APP_GAME_IDS].sort());
    expect([...APP_GAME_IDS].sort()).toEqual(
      ["battle", "clash", "demotion", "skirmish"].sort(),
    );
  });

  it.each([
    ["skirmish", "Skirmish", "Play on an 8x8 board with a 16-piece army."],
    [
      "clash",
      "Clash",
      "Play on a 10x10 board with a 20-piece army. Irregular lakes.",
    ],
    ["battle", "Battle", "Play on a 12x12 board with a 25-piece army."],
    [
      "demotion",
      "Demotion",
      "Play on an 8x8 fixed board. When a piece wins a battle, it is demoted one rank.",
    ],
  ] as const)(
    "%s's name and description match the picker's copy character for character",
    (id, name, description) => {
      expect(GAME_CATALOG[id].name).toBe(name);
      expect(GAME_CATALOG[id].description).toBe(description);
    },
  );

  it.each(["skirmish", "clash", "battle"] as const)(
    "%s's board-size phrase matches boardSizeDescription of its own standard configuration, so the catalog can never drift from the real layout",
    (id) => {
      const entry = GAME_CATALOG[id];
      if (entry.source.major !== 2) {
        throw new Error("expected a major-2 entry");
      }
      expect(entry.boardSizePhrase).toBe(
        boardSizeDescription(buildGameConfiguration(entry.source.gameId)),
      );
    },
  );

  it("demotion's board-size phrase is 'an 8x8 board'", () => {
    expect(GAME_CATALOG.demotion.boardSizePhrase).toBe("an 8x8 board");
  });

  it("orders the games Skirmish, Clash, Battle, then Demotion last (Decision 4)", () => {
    const byOrder = [...APP_GAME_IDS].sort(
      (a, b) => GAME_CATALOG[a].order - GAME_CATALOG[b].order,
    );
    expect(byOrder).toEqual(["skirmish", "clash", "battle", "demotion"]);
  });
});

describe("offeredGames", () => {
  it("offers exactly Skirmish, Clash, Battle, then Demotion last (story 00000036, Step 14)", () => {
    expect(offeredGames()).toEqual(["skirmish", "clash", "battle", "demotion"]);
  });

  it("always includes demotion, regardless of games.ts's playableGames() floor - it has no combination to fail", () => {
    const offered: readonly AppGameId[] = offeredGames();
    expect(offered).toContain("demotion");
  });
});

describe("ruleChoicesFromConfiguration", () => {
  it("reads both diagonal-attack flags off a resolved configuration", () => {
    const configuration = buildGameConfiguration("battle", {
      DIAGONAL_ATTACKABLE: "all",
      DIAGONAL_ATTACK_PATH: "open_path",
    });
    expect(ruleChoicesFromConfiguration(configuration)).toEqual({
      DIAGONAL_ATTACKABLE: "all",
      DIAGONAL_ATTACK_PATH: "open_path",
    });
  });

  it("reads the standard values when nothing was overridden", () => {
    const configuration = buildGameConfiguration("skirmish");
    expect(ruleChoicesFromConfiguration(configuration)).toEqual({
      DIAGONAL_ATTACKABLE: "movable_only",
      DIAGONAL_ATTACK_PATH: "always",
    });
  });
});
