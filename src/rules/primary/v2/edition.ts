// Edition registry for ruleset major 2.
//
// An edition pairs a `BOARD_LAYOUT`, an `ARMY_COMPOSITION` and a
// `TOWER_PLACEMENT` value and carries the resulting edition-id string - the
// full `Ruleset` record tag per technical-notes.md's "editions and flags"
// model (companion capture-the-flag repository, the single source of
// truth). See this story's implementation plan ("Grounding facts") for the
// source table (rules.md Appendix B).
//
// Story 00000025 added the registry's third edition and its `status` field:
// the registry now holds three editions - `2-0:BATTLE` and `2-1:SKIRMISH`
// (both `active`, i.e. offered for play) and `2-0:SKIRMISH` (`superseded` -
// still resolvable so a record naming it keeps reviewing, but never offered
// as a game to start). The two active editions no longer share a minor
// (Skirmish is at `2-1`, Battle at `2-0`); nothing here or downstream may
// assume they do.
//
// This module is threaded through the rule engine and its consumers:
// `board.ts`/`movement.ts`/`combat.ts`/`outcome.ts`/`placement.ts` take an
// `Edition`'s resolved `BoardLayout`; `gameState.ts`'s game-state artifacts
// carry the resolved `Edition`; `readRecord.ts` dispatches on the `Ruleset`
// tag by looking it up in `EDITIONS` (every registered edition, readable
// regardless of status); and `HotSeatGame.tsx`/`GameChoice.tsx` let the
// player choose between the editions `playableEditions()` returns (active
// editions only).

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
export type EditionId = "2-0:BATTLE" | "2-1:SKIRMISH" | "2-0:SKIRMISH";

/**
 * The `TOWER_PLACEMENT` variant (rules.md Appendix A): whether a Tower
 * placement must additionally avoid standing directly in front of a lane.
 * `spacing_only` is the rules' default - the existing "no two Towers may
 * touch, including diagonally" rule alone, which is all every edition before
 * `2-1:SKIRMISH` ever played. `spacing_and_lanes` adds the lane restriction.
 * Every registered `Edition` below names its value explicitly; there is no
 * implicit default in the registry itself.
 */
export type TowerPlacement = "spacing_only" | "spacing_and_lanes";

/**
 * Whether an edition is offered as a game to start. `"active"` editions are
 * both readable and playable; `"superseded"` editions (rules.md Appendix B's
 * Historical table) remain readable - a record naming one still reviews -
 * but are never offered by the picker. Mirrors the rules' own Active /
 * Historical tables.
 */
export type EditionStatus = "active" | "superseded";

export interface Edition {
  readonly id: EditionId;
  readonly boardLayoutId: BoardLayoutId;
  readonly armyCompositionId: ArmyCompositionId;
  readonly towerPlacement: TowerPlacement;
  readonly status: EditionStatus;
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
 * unchanged from major 1. `spacing_only` Tower placement (rules.md Appendix
 * B): the lane restriction closes nothing on this board (its home zones sit
 * a buffer row away from the lakes), so the value is spelled out explicitly
 * per the registry's own rule even though it changes nothing about a Battle
 * game. Exported (mirroring `board.ts`'s `BATTLE_LAYOUT` and
 * `armyComposition.ts`'s `BATTLE_ARMY`) so fixtures elsewhere that need a
 * concrete `Edition` - now that `InitialGameState.edition`/`PlayState.edition`
 * are required (story 00000023's peer review, finding #2) - can use it
 * explicitly rather than relying on a silent default.
 */
export const BATTLE_EDITION: Edition = {
  id: "2-0:BATTLE",
  boardLayoutId: "standard_144",
  armyCompositionId: "standard_battle",
  towerPlacement: "spacing_only",
  status: "active",
  boardLayout: BOARD_LAYOUTS.standard_144,
  army: ARMY_COMPOSITIONS.standard_battle.roster,
};

/**
 * Skirmish (`2-1:SKIRMISH`): the 8x8 board with the 16-piece army - the
 * recommended game for a new player. `spacing_and_lanes` Tower placement
 * (rules.md Appendix A/B, story 00000025): in addition to the existing
 * spacing rule, no Tower may stand directly in front of a lane. This is the
 * edition new Skirmish games are set up, played, and recorded under; the
 * superseded `2-0:SKIRMISH` (below) played `spacing_only` instead. Exported
 * alongside `BATTLE_EDITION` so both active editions have exactly one
 * spelling in fixtures and consumers, rather than one named constant and one
 * map lookup (story 00000023's peer review, finding #18) - a ruleset name
 * (`SKIRMISH_EDITION`) means its current edition.
 */
export const SKIRMISH_EDITION: Edition = {
  id: "2-1:SKIRMISH",
  boardLayoutId: "standard_64",
  armyCompositionId: "standard_skirmish",
  towerPlacement: "spacing_and_lanes",
  status: "active",
  boardLayout: BOARD_LAYOUTS.standard_64,
  army: ARMY_COMPOSITIONS.standard_skirmish.roster,
};

/**
 * Skirmish, superseded edition (`2-0:SKIRMISH`, rules.md Appendix B's
 * Historical table, story 00000025): the same board and army as
 * `SKIRMISH_EDITION`, but `spacing_only` Tower placement - towers were
 * allowed in front of a lane under this edition. Kept in `EDITIONS` so a
 * record naming it still reviews, but never returned by `playableEditions()`
 * and never offered by the picker. Exported separately (rather than only
 * reachable via `EDITIONS["2-0:SKIRMISH"]`) so tests that deliberately
 * exercise the historical path - as opposed to a fresh game, which always
 * means `SKIRMISH_EDITION` - can reach it without a map lookup, mirroring the
 * `BATTLE_EDITION`/`SKIRMISH_EDITION` precedent.
 */
export const SUPERSEDED_SKIRMISH_EDITION: Edition = {
  id: "2-0:SKIRMISH",
  boardLayoutId: "standard_64",
  armyCompositionId: "standard_skirmish",
  towerPlacement: "spacing_only",
  status: "superseded",
  boardLayout: BOARD_LAYOUTS.standard_64,
  army: ARMY_COMPOSITIONS.standard_skirmish.roster,
};

/**
 * Every defined edition, keyed by its id - what `readRecord.ts` resolves a
 * `Ruleset` tag against, so a record naming any of the three (including the
 * superseded `2-0:SKIRMISH`) still reviews. Not all are necessarily playable
 * - see `playableEditions`.
 */
export const EDITIONS: Readonly<Record<EditionId, Edition>> = {
  "2-0:BATTLE": BATTLE_EDITION,
  "2-1:SKIRMISH": SKIRMISH_EDITION,
  "2-0:SKIRMISH": SUPERSEDED_SKIRMISH_EDITION,
};

/** Looks up an edition by its id. */
export function editionById(id: EditionId): Edition {
  return EDITIONS[id];
}

/**
 * The editions actually offered for play: those that are `active` (rules.md
 * Appendix B's Active table - excludes the superseded `2-0:SKIRMISH`, which
 * stays readable but is never offered) *and* whose army fits their board's
 * home zone. The two active editions (`2-0:BATTLE`, `2-1:SKIRMISH`) are
 * designed to pass the fit check; it exists so an invalid pairing is simply
 * never offered, rather than needing to be rejected elsewhere.
 */
export function playableEditions(): Edition[] {
  return Object.values(EDITIONS).filter(
    (edition) =>
      edition.status === "active" &&
      combinationFits(edition.boardLayoutId, edition.armyCompositionId),
  );
}
