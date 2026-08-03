// Army composition configuration for the ruleset major-2 editions
// (`2-0:BATTLE` / `2-0:SKIRMISH`).
//
// An army roster is a per-type piece count, keyed by `ARMY_COMPOSITION` per
// rules.md §2.2 / Appendix B (companion capture-the-flag repository, the
// single source of truth) and this story's implementation plan ("Grounding
// facts"). The piece catalog itself (names, rank codes, symbols) is unchanged
// from major 1 and lives in `pieces.ts`; this module only varies the
// per-type *quantities* a side fields under each composition.
//
// Story 00000023's Step 4 wires this module into the placement model
// (`placement.ts`'s `PlacementState.army`, defaulting to `BATTLE_ARMY`) and
// the tray (`Tray.tsx`), replacing `pieces.ts`'s former fixed, Battle-only
// `ARMY_SIZE`/`freshInventory`: a fresh inventory and a complete army are now
// a function of the chosen roster, not a constant.

import {
  PIECE_CATALOG,
  PIECE_TYPES,
  type Inventory,
  type PieceTypeId,
} from "./pieces.ts";

/** Identifies one of the two published army compositions. */
export type ArmyCompositionId = "standard_battle" | "standard_skirmish";

/** Per-type piece counts making up one side's full army under a composition. */
export type ArmyRoster = Readonly<Record<PieceTypeId, number>>;

export interface ArmyCompositionEntry {
  readonly id: ArmyCompositionId;
  readonly roster: ArmyRoster;
}

/** Total number of pieces a roster fields for one side (sum of every type's count). */
export function armySize(roster: ArmyRoster): number {
  return PIECE_TYPES.reduce((total, id) => total + roster[id], 0);
}

/**
 * A fresh, full inventory for `roster`: every type at its full quantity for
 * that army (all 8 piece types, some possibly at zero - e.g. Skirmish's Foot
 * Soldier and Militia). `ArmyRoster` and `Inventory` describe the same shape
 * (a full count per `PieceTypeId`); this is a defensive copy, not a
 * derivation, so a caller's mutation of the result never reaches the roster
 * itself.
 */
export function freshInventory(roster: ArmyRoster): Inventory {
  return { ...roster };
}

/**
 * Battle (`standard_battle`): the existing 25-piece roster, unchanged from
 * major 1 - three each of the six ranked pieces, six Towers, one Flag. Reuses
 * `pieces.ts`'s catalog quantities directly, so the two never drift apart.
 */
function standardBattleRoster(): ArmyRoster {
  const roster = {} as Record<PieceTypeId, number>;
  for (const id of PIECE_TYPES) {
    roster[id] = PIECE_CATALOG[id].quantityPerSide;
  }
  return roster;
}

/**
 * Skirmish (`standard_skirmish`): a 16-piece roster - three each of ranks 1-4
 * (Master-of-Arms, Champion, Knight, Halberdier), three Towers, one Flag. No
 * Foot Soldier (rank 5) or Militia (rank 6).
 */
const STANDARD_SKIRMISH_ROSTER: ArmyRoster = {
  masterOfArms: 3,
  champion: 3,
  knight: 3,
  halberdier: 3,
  footSoldier: 0,
  militia: 0,
  tower: 3,
  flag: 1,
};

/** Every `ARMY_COMPOSITION` value, keyed by its id. */
export const ARMY_COMPOSITIONS: Readonly<
  Record<ArmyCompositionId, ArmyCompositionEntry>
> = {
  standard_battle: { id: "standard_battle", roster: standardBattleRoster() },
  standard_skirmish: {
    id: "standard_skirmish",
    roster: STANDARD_SKIRMISH_ROSTER,
  },
};

/**
 * Battle's roster (`standard_battle`) - the army the live app fields today,
 * and the default `placement.ts`/`placementSession.ts` fall back to (mirrors
 * `board.ts`'s `BATTLE_LAYOUT`).
 */
export const BATTLE_ARMY: ArmyRoster = ARMY_COMPOSITIONS.standard_battle.roster;
