// Checks `startScreenChoices.ts`'s catalog and filter (story 00000034,
// Step 1). Deliberately does NOT assert the current value of any
// `featureVisibility.ts` constant: the filter tests below build their own
// synthetic catalogs so that flipping a real constant to `true` never
// breaks this suite (Decision 1).

import { describe, expect, it } from "vitest";
import { HOW_TO_PLAY_BUTTON } from "./rules/rulesCopy.ts";
import {
  START_SCREEN_CHOICES,
  visibleStartScreenChoices,
  type StartScreenChoice,
} from "./startScreenChoices.ts";

describe("START_SCREEN_CHOICES", () => {
  it("has exactly four entries, in id order", () => {
    expect(START_SCREEN_CHOICES.map((choice) => choice.id)).toEqual([
      "howToPlay",
      "playAGame",
      "playAgainstTheComputer",
      "reviewAGame",
    ]);
  });

  it("takes howToPlay's title and detail from HOW_TO_PLAY_BUTTON", () => {
    const howToPlay = START_SCREEN_CHOICES.find(
      (choice) => choice.id === "howToPlay",
    );
    expect(howToPlay?.title).toBe(HOW_TO_PLAY_BUTTON.title);
    expect(howToPlay?.detail).toBe(HOW_TO_PLAY_BUTTON.detail);
  });

  it("has today's title and detail for playAGame", () => {
    const playAGame = START_SCREEN_CHOICES.find(
      (choice) => choice.id === "playAGame",
    );
    expect(playAGame?.title).toBe("Play a game");
    expect(playAGame?.detail).toBe("Two players, one device");
  });

  it("has today's title and detail for playAgainstTheComputer", () => {
    const computer = START_SCREEN_CHOICES.find(
      (choice) => choice.id === "playAgainstTheComputer",
    );
    expect(computer?.title).toBe("Play against the computer");
    expect(computer?.detail).toBe("Choose a side, place your army, then play");
  });

  it("has today's title and detail for reviewAGame", () => {
    const reviewAGame = START_SCREEN_CHOICES.find(
      (choice) => choice.id === "reviewAGame",
    );
    expect(reviewAGame?.title).toBe("Review a game");
    expect(reviewAGame?.detail).toBe("Watch a recorded game");
  });

  it("carries an unavailability note only on playAgainstTheComputer", () => {
    const withNotes = START_SCREEN_CHOICES.filter(
      (choice) => choice.note !== undefined,
    );
    expect(withNotes.map((choice) => choice.id)).toEqual([
      "playAgainstTheComputer",
    ]);
    expect(withNotes[0]?.note).toBe(
      "Not available right now - the rules changed and the computer player needs to catch up.",
    );
  });

  it("keeps howToPlay and playAGame unconditionally visible", () => {
    const howToPlay = START_SCREEN_CHOICES.find(
      (choice) => choice.id === "howToPlay",
    );
    const playAGame = START_SCREEN_CHOICES.find(
      (choice) => choice.id === "playAGame",
    );
    expect(howToPlay?.visible).toBe(true);
    expect(playAGame?.visible).toBe(true);
  });
});

describe("visibleStartScreenChoices", () => {
  // Synthetic catalogs only - never the real START_SCREEN_CHOICES - so that
  // flipping a real featureVisibility.ts constant to `true` can never break
  // this suite.
  const makeChoice = (id: string, visible: boolean): StartScreenChoice => ({
    id: id as StartScreenChoice["id"],
    title: id,
    detail: id,
    visible,
  });

  it("keeps all entries, in order, when every one is visible", () => {
    const catalog = [
      makeChoice("howToPlay", true),
      makeChoice("playAGame", true),
      makeChoice("playAgainstTheComputer", true),
      makeChoice("reviewAGame", true),
    ];
    expect(visibleStartScreenChoices(catalog).map((c) => c.id)).toEqual([
      "howToPlay",
      "playAGame",
      "playAgainstTheComputer",
      "reviewAGame",
    ]);
  });

  it("drops invisible entries while preserving the order of the rest", () => {
    const catalog = [
      makeChoice("howToPlay", true),
      makeChoice("playAGame", true),
      makeChoice("playAgainstTheComputer", false),
      makeChoice("reviewAGame", false),
    ];
    expect(visibleStartScreenChoices(catalog).map((c) => c.id)).toEqual([
      "howToPlay",
      "playAGame",
    ]);
  });

  it("preserves order regardless of which entries are hidden", () => {
    const catalog = [
      makeChoice("a", false),
      makeChoice("b", true),
      makeChoice("c", false),
      makeChoice("d", true),
    ];
    expect(visibleStartScreenChoices(catalog).map((c) => c.id)).toEqual([
      "b",
      "d",
    ]);
  });
});
