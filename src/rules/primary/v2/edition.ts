// Edition registry for ruleset major 2.
//
// An edition pairs a `BOARD_LAYOUT` and an `ARMY_COMPOSITION` and carries the
// resulting edition-id string - the full `Ruleset` record tag per
// technical-notes.md's "editions and flags" model (companion
// capture-the-flag repository, the single source of truth). The two active
// editions differ only in those two flags. See this story's implementation
// plan ("Grounding facts") for the source table.
//
// This module is threaded through the rule engine and its consumers:
// `board.ts`/`movement.ts`/`combat.ts`/`outcome.ts`/`placement.ts` take an
// `Edition`'s resolved `BoardLayout`; `gameState.ts`'s game-state artifacts
// carry the resolved `Edition`; `readRecord.ts` dispatches on the `Ruleset`
// tag by looking it up here; and `HotSeatGame.tsx`/`GameChoice.tsx` (story
// 00000023's Step 7) let the player choose between the two registered
// editions.

import {
  armySize,
  ARMY_COMPOSITIONS,
  type ArmyCompositionId,
  type ArmyRoster,
} from "./armyComposition.ts";
import {
  BOARD_LAYOUTS,
  homeZoneSize,
  type BoardLayout,
  type BoardLayoutId,
} from "./boardLayout.ts";

/** The full edition id, as written in the `Ruleset` record tag. */
export type EditionId = "2-0:BATTLE" | "2-0:SKIRMISH";

export interface Edition {
  readonly id: EditionId;
  readonly boardLayoutId: BoardLayoutId;
  readonly armyCompositionId: ArmyCompositionId;
  /** The resolved board geometry for this edition. */
  readonly boardLayout: BoardLayout;
  /** The resolved army roster for this edition. */
  readonly army: ArmyRoster;
}

/** True if a roster's total piece count fits within a board layout's per-side home zone. */
export function armyFitsBoard(
  boardLayout: BoardLayout,
  army: ArmyRoster,
): boolean {
  return armySize(army) <= homeZoneSize(boardLayout);
}

/**
 * True if the named board layout and army composition could be combined into
 * a playable edition - i.e. the army fits the board's home zone. Independent
 * of whether that combination is one of the two published editions below;
 * `BOARD_LAYOUT` and `ARMY_COMPOSITION` are orthogonal, so not every
 * combination is playable (e.g. the 25-piece Battle army does not fit the
 * Skirmish board's 24-square home zone).
 */
export function combinationFits(
  boardLayoutId: BoardLayoutId,
  armyCompositionId: ArmyCompositionId,
): boolean {
  return armyFitsBoard(
    BOARD_LAYOUTS[boardLayoutId],
    ARMY_COMPOSITIONS[armyCompositionId].roster,
  );
}

/**
 * Battle (`2-0:BATTLE`): the existing 12x12 board with the 25-piece army,
 * unchanged from major 1. Exported (mirroring `board.ts`'s `BATTLE_LAYOUT`
 * and `armyComposition.ts`'s `BATTLE_ARMY`) so fixtures elsewhere that need a
 * concrete `Edition` - now that `InitialGameState.edition`/`PlayState.edition`
 * are required (story 00000023's peer review, finding #2) - can use it
 * explicitly rather than relying on a silent default.
 */
export const BATTLE_EDITION: Edition = {
  id: "2-0:BATTLE",
  boardLayoutId: "standard_144",
  armyCompositionId: "standard_battle",
  boardLayout: BOARD_LAYOUTS.standard_144,
  army: ARMY_COMPOSITIONS.standard_battle.roster,
};

/**
 * Skirmish (`2-0:SKIRMISH`): the 8x8 board with the 16-piece army - the
 * recommended game for a new player.
 */
const SKIRMISH: Edition = {
  id: "2-0:SKIRMISH",
  boardLayoutId: "standard_64",
  armyCompositionId: "standard_skirmish",
  boardLayout: BOARD_LAYOUTS.standard_64,
  army: ARMY_COMPOSITIONS.standard_skirmish.roster,
};

/** Every defined edition, keyed by its id. Not all are necessarily playable - see `playableEditions`. */
export const EDITIONS: Readonly<Record<EditionId, Edition>> = {
  "2-0:BATTLE": BATTLE_EDITION,
  "2-0:SKIRMISH": SKIRMISH,
};

/** Looks up an edition by its id. */
export function editionById(id: EditionId): Edition {
  return EDITIONS[id];
}

/**
 * The editions actually offered for play: those whose army fits their
 * board's home zone. Both published editions (`2-0:BATTLE`, `2-0:SKIRMISH`)
 * are designed to pass this check; it exists so an invalid pairing is simply
 * never offered, rather than needing to be rejected elsewhere.
 */
export function playableEditions(): Edition[] {
  return Object.values(EDITIONS).filter((edition) =>
    combinationFits(edition.boardLayoutId, edition.armyCompositionId),
  );
}
