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
// this module only transcribes that table into data. `RuleFigure.tsx` (Step
// 6) is the thin renderer that reads this module and `rulesCopy.ts` (Step 2,
// the page's text) and draws every figure on the same 5x5 board cutout
// (story.md's amendment 3 - an earlier round briefly drew figures 5-10
// without a board, per amendment 2; that round is reversed, and this module
// carries no trace of it); nothing here knows about pixels, SVG or React.
//
// Every figure keeps its real, engine-checked squares regardless of how it
// is drawn, because those squares are what `figures.test.ts` feeds to
// `legalDestinations`/`legalAttacks`/`resolveCombat`. A figure whose squares
// stopped being real would silently stop being checked.

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

/**
 * One of the ten pictures: a stable id, the pieces it places, and its
 * marking. Every figure is drawn on the same 5x5 board cutout
 * (story.md's amendment 3), so there is nothing here to say otherwise.
 */
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
  // 3. Movement for attacks (one square ahead) - an enemy one square away
  // orthogonally is marked as attackable; no fight is resolved here. A
  // one-square attack, not two, so the ten pictures between them cover one
  // square ahead (3), diagonal (4) and two squares ahead (5-10) rather than
  // repeating the same two-square shape (story.md amendment 6).
  {
    id: "attackOrthogonal",
    pieces: [
      { square: "F3", side: "white", pieceType: "knight" },
      { square: "F4", side: "black", pieceType: "knight" },
    ],
    marking: { kind: "attack", from: "F3", to: "F4", removed: [] },
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
  // the defender is removed. The attack spans two squares (F2 -> F4),
  // leaving F3 deliberately empty for Step 7's arrow to occupy - a real,
  // legal two-square attack (the attacker is unencumbered), not a drawing
  // offset (story.md amendment 5).
  {
    id: "combatRank1Wins",
    pieces: [
      { square: "F2", side: "white", pieceType: "masterOfArms" },
      { square: "F4", side: "black", pieceType: "champion" },
    ],
    marking: { kind: "attack", from: "F2", to: "F4", removed: ["F4"] },
  },
  // 6. Combat - a rank 3 attacker loses outright against a rank 2 defender
  // (a sacrifice); the attacker is removed. Same F2 -> F4 two-square attack,
  // F3 empty (story.md amendment 5).
  {
    id: "combatRank3Loses",
    pieces: [
      { square: "F2", side: "white", pieceType: "knight" },
      { square: "F4", side: "black", pieceType: "champion" },
    ],
    marking: { kind: "attack", from: "F2", to: "F4", removed: ["F2"] },
  },
  // 7. Equal-ranked pieces and Tower attacks - equal ranks are a mutual
  // loss; both pieces are removed. Same F2 -> F4 two-square attack, F3 empty
  // (story.md amendment 5).
  {
    id: "combatEqualRank",
    pieces: [
      { square: "F2", side: "white", pieceType: "halberdier" },
      { square: "F4", side: "black", pieceType: "halberdier" },
    ],
    marking: { kind: "attack", from: "F2", to: "F4", removed: ["F2", "F4"] },
  },
  // 8. Equal-ranked pieces and Tower attacks - attacking a Tower is always a
  // mutual loss, whatever attacks it. The attack is orthogonal, never
  // diagonal: under the default DIAGONAL_ATTACKABLE=movable_only, a Tower
  // cannot be attacked diagonally at all. Same F2 -> F4 two-square attack,
  // F3 empty (story.md amendment 5).
  {
    id: "combatTower",
    pieces: [
      { square: "F2", side: "white", pieceType: "halberdier" },
      { square: "F4", side: "black", pieceType: "tower" },
    ],
    marking: { kind: "attack", from: "F2", to: "F4", removed: ["F2", "F4"] },
  },
  // 9. Rank-up - a rank 3 attacker with a friendly rank 3 piece beside it
  // (E2, adjacent to the attacker's origin F2) turns what would otherwise be
  // a clean loss against the stronger rank 2 defender into a mutual loss.
  // Same F2 -> F4 two-square attack, F3 empty (story.md amendment 5); the
  // supporting piece at E2 does not encumber the attacker, so the attack
  // stays legal.
  {
    id: "combatRankUpAttack",
    pieces: [
      { square: "F2", side: "white", pieceType: "knight" },
      { square: "E2", side: "white", pieceType: "knight" },
      { square: "F4", side: "black", pieceType: "champion" },
    ],
    marking: { kind: "attack", from: "F2", to: "F4", removed: ["F2", "F4"] },
  },
  // 10. Rank-up - the enemy's stronger rank 2 piece attacks a rank 3
  // defender that has a friendly rank 3 piece directly behind it; the
  // defender's formation bonus turns what would otherwise be a clean
  // attacker win into a mutual loss. The attack spans two squares
  // (F4 -> F2), leaving F3 deliberately empty for Step 7's arrow
  // (story.md amendment 5). The supporting piece is at F1, directly behind
  // the defender at F2 on the far side from the blue attacker at F4 (moved
  // here from F2 - which is now the defender's own square - because the
  // defender itself moved; implementation plan, Decision 12, as amended by
  // story.md amendment 5). F1 is orthogonally adjacent to the defender and
  // not adjacent (orthogonally or diagonally) to the attacker, so it does
  // not hand the attacker a second legal attack.
  {
    id: "combatRankUpDefend",
    pieces: [
      { square: "F4", side: "black", pieceType: "champion" },
      { square: "F2", side: "white", pieceType: "knight" },
      { square: "F1", side: "white", pieceType: "knight" },
    ],
    marking: { kind: "attack", from: "F4", to: "F2", removed: ["F4", "F2"] },
  },
];
