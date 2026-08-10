// The ten pictures the "How to play" popup draws (story 00000032), declared
// as plain data - no React, no JSX, no CSS.
//
// This module exists precisely so the figures can be unit-tested in this
// repository's `node`-only Vitest environment (see CONTRIBUTING.md, "Testing
// accessibility", and this story's implementation plan, "Grounding facts":
// there is no DOM/component test environment here, so anything that *can* be
// pure data is pulled out of the `.tsx` layer). `figures.test.ts` places each
// figure's pieces on a real Battle board and checks its marked squares
// against `movement.ts`'s `legalDestinations`/`legalAttacks`, and its
// combat figures' outcomes against `combat.ts`'s `resolveCombat`. A figure
// that disagrees with the engine is a **wrong figure** - never a reason to
// touch `src/rules/` (this story is read-only with respect to how the game
// plays).
//
// The ten figures and their placements are fixed by the implementation
// plan's Decision 7, already checked against the engine (under all four
// combinations of the two diagonal-attack flags) while the plan was written;
// this module only transcribes that table into data. `RuleFigure.tsx` (a
// later step) is the thin renderer that reads this module and `rulesCopy.ts`
// (Step 2, the popup's text); nothing here knows about pixels, SVG or React.

import type { Side } from "../../rules/primary/v2/board.ts";
import {
  BOARD_LAYOUTS,
  type BoardLayout,
} from "../../rules/primary/v2/boardLayout.ts";
import type { PieceTypeId } from "../../rules/primary/v2/pieces.ts";

/**
 * The 5x5 window every figure is cut from: the Battle board
 * (`BOARD_LAYOUTS.standard_144`), anchored at D1 - columns D-H by rows 1-5,
 * centred on F3 (implementation plan, Decision 6). Battle's lake rows (6-7)
 * are entirely outside this window, so nothing a figure marks depends on
 * board geometry the popup never explains; `figures.test.ts` pins that down.
 */
export const FIGURE_WINDOW: {
  readonly layout: BoardLayout;
  /** The window's top-left-most (lowest column, lowest row) square, by absolute square key. */
  readonly anchor: string;
  readonly width: number;
  readonly height: number;
} = {
  layout: BOARD_LAYOUTS.standard_144,
  anchor: "D1",
  width: 5,
  height: 5,
};

/**
 * One piece a figure places, by absolute square key (e.g. `"F3"`) on
 * `FIGURE_WINDOW.layout` - not a window-relative coordinate. Naming pieces
 * this way is what lets `figures.test.ts` place a figure's pieces straight
 * onto a real `BoardState` and ask the real rule engine what it thinks;
 * `RuleFigure.tsx` derives the window-relative row/column from the anchor
 * itself.
 */
export interface FigurePiece {
  readonly square: string;
  readonly side: Side;
  readonly pieceType: PieceTypeId;
}

/**
 * What a figure marks: either a set of empty squares reachable by a move
 * (figures 1 and 2), or a single attack from one square onto another
 * (figures 3-10), carrying the set of squares whose pieces the fight
 * removes. `removed` is empty for figures 3 and 4, which mark an enemy as
 * attackable without any fight happening - the marking is the same shape
 * throughout the attack figures (Decision 1: the same arrow marks "may
 * attack" and "did attack and here is what happened").
 */
export type FigureMarking =
  | {
      readonly kind: "move";
      readonly origin: string;
      readonly destinations: readonly string[];
    }
  | {
      readonly kind: "attack";
      readonly from: string;
      readonly to: string;
      readonly removed: readonly string[];
    };

/** Stable ids for the ten figures, in the order they appear in the popup. */
export type FigureId =
  | "movement"
  | "slowedMovement"
  | "attackOrthogonal"
  | "attackDiagonal"
  | "combatRank1Wins"
  | "combatRank3Loses"
  | "combatEqualRank"
  | "combatTower"
  | "combatRankUpAttack"
  | "combatRankUpDefend";

/** One of the ten pictures: a stable id, the pieces it places, and its marking. */
export interface Figure {
  readonly id: FigureId;
  readonly pieces: readonly FigurePiece[];
  readonly marking: FigureMarking;
}

/**
 * The ten figures (implementation plan, Decision 7), in popup order. Rank 1
 * = `masterOfArms`, rank 2 = `champion`, rank 3 = `knight`, rank 4 =
 * `halberdier`. Red = `"white"`, Blue = `"black"` (the popup's fixed
 * friendly/enemy colour convention - see story.md, "Players and colors").
 */
export const FIGURES: readonly Figure[] = [
  // 1. Movement - an unencumbered friendly piece in the open reaches all
  // eight one- and two-square orthogonal destinations.
  {
    id: "movement",
    pieces: [{ square: "F3", side: "white", pieceType: "knight" }],
    marking: {
      kind: "move",
      origin: "F3",
      destinations: ["D3", "E3", "F1", "F2", "F4", "F5", "G3", "H3"],
    },
  },
  // 2. Slowed movement - a diagonally adjacent enemy encumbers the same
  // piece, limiting it to its four one-square destinations.
  {
    id: "slowedMovement",
    pieces: [
      { square: "F3", side: "white", pieceType: "knight" },
      { square: "E4", side: "black", pieceType: "knight" },
    ],
    marking: {
      kind: "move",
      origin: "F3",
      destinations: ["E3", "F2", "F4", "G3"],
    },
  },
  // 3. Movement for attacks (two squares ahead) - an enemy two squares away
  // orthogonally is marked as attackable; no fight is resolved here.
  {
    id: "attackOrthogonal",
    pieces: [
      { square: "F3", side: "white", pieceType: "knight" },
      { square: "F5", side: "black", pieceType: "knight" },
    ],
    marking: { kind: "attack", from: "F3", to: "F5", removed: [] },
  },
  // 4. Movement for attacks (immediate diagonal) - an enemy diagonally
  // adjacent is marked as attackable. The target is a numbered piece (never
  // Tower or Flag) and both squares flanking the diagonal (F4, G3) are left
  // empty, so this stays true under DIAGONAL_ATTACKABLE=all and
  // DIAGONAL_ATTACK_PATH=open_path as well as the defaults.
  {
    id: "attackDiagonal",
    pieces: [
      { square: "F3", side: "white", pieceType: "knight" },
      { square: "G4", side: "black", pieceType: "knight" },
    ],
    marking: { kind: "attack", from: "F3", to: "G4", removed: [] },
  },
  // 5. Combat - a rank 1 attacker wins outright against a rank 2 defender;
  // the defender is removed.
  {
    id: "combatRank1Wins",
    pieces: [
      { square: "F2", side: "white", pieceType: "masterOfArms" },
      { square: "F3", side: "black", pieceType: "champion" },
    ],
    marking: { kind: "attack", from: "F2", to: "F3", removed: ["F3"] },
  },
  // 6. Combat - a rank 3 attacker loses outright against a rank 2 defender
  // (a sacrifice); the attacker is removed.
  {
    id: "combatRank3Loses",
    pieces: [
      { square: "F2", side: "white", pieceType: "knight" },
      { square: "F3", side: "black", pieceType: "champion" },
    ],
    marking: { kind: "attack", from: "F2", to: "F3", removed: ["F2"] },
  },
  // 7. Equal-ranked pieces and Tower attacks - equal ranks are a mutual
  // loss; both pieces are removed.
  {
    id: "combatEqualRank",
    pieces: [
      { square: "F2", side: "white", pieceType: "halberdier" },
      { square: "F3", side: "black", pieceType: "halberdier" },
    ],
    marking: { kind: "attack", from: "F2", to: "F3", removed: ["F2", "F3"] },
  },
  // 8. Equal-ranked pieces and Tower attacks - attacking a Tower is always a
  // mutual loss, whatever attacks it. The attack is orthogonal, never
  // diagonal: under the default DIAGONAL_ATTACKABLE=movable_only, a Tower
  // cannot be attacked diagonally at all.
  {
    id: "combatTower",
    pieces: [
      { square: "F2", side: "white", pieceType: "halberdier" },
      { square: "F3", side: "black", pieceType: "tower" },
    ],
    marking: { kind: "attack", from: "F2", to: "F3", removed: ["F2", "F3"] },
  },
  // 9. Rank-up - a rank 3 attacker with a friendly rank 3 piece beside it
  // (E2, adjacent to the attacker's origin F2) turns what would otherwise be
  // a clean loss against the stronger rank 2 defender into a mutual loss.
  {
    id: "combatRankUpAttack",
    pieces: [
      { square: "F2", side: "white", pieceType: "knight" },
      { square: "E2", side: "white", pieceType: "knight" },
      { square: "F3", side: "black", pieceType: "champion" },
    ],
    marking: { kind: "attack", from: "F2", to: "F3", removed: ["F2", "F3"] },
  },
  // 10. Rank-up - the enemy's stronger rank 2 piece attacks a rank 3
  // defender that has a friendly rank 3 piece beside it (E2, diagonally
  // adjacent to the defender's square F3, and not adjacent to the attacker
  // at F4); the defender's formation bonus turns what would otherwise be a
  // clean attacker win into a mutual loss.
  {
    id: "combatRankUpDefend",
    pieces: [
      { square: "F4", side: "black", pieceType: "champion" },
      { square: "F3", side: "white", pieceType: "knight" },
      { square: "E2", side: "white", pieceType: "knight" },
    ],
    marking: { kind: "attack", from: "F4", to: "F3", removed: ["F4", "F3"] },
  },
];
