// Combat resolution rule logic for ruleset PRIMARY:1.1, Phase 2 §4.3
// (companion capture-the-flag repository, `doc/ruleset/rules.md`, the single
// source of truth).
//
// Attacking is moving a piece onto an enemy-occupied square (movement.ts's
// `legalAttacks`, story 00000005 Step 3, decides *which* squares qualify).
// This module resolves what happens once an attack is chosen: the rank
// table, equal-rank mutual loss, every non-Archer special case (Knight
// charge, Assassin, Sapper vs. Tower, Halberdier anti-charge), and the
// Archer's defensive-support override, which can flip an "attacker wins"
// base result into mutual loss.
//
// This module is pure rule logic - no React - and builds only on the board
// geometry (board.ts), the piece catalog (pieces.ts), and `BoardState`
// (gameState.ts); it has no further dependencies.

import {
  COLUMNS,
  isLake,
  squareKey,
  type Column,
  type Row,
  type Square,
} from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { PIECE_CATALOG } from "./pieces.ts";

/** The three possible resolutions of an encounter, per rules.md §4.3. */
export type CombatResult = "attackerWins" | "attackerLoses" | "mutualLoss";

/**
 * A fully resolved encounter: which pieces fought, where, what happened, and
 * whether Archer defensive support changed the outcome. Carries enough for
 * the UI announcement (story 00000005 Step 6) and for story 00000006's
 * game-end detection (flag capture, the inactivity/progress counters) to
 * consume without a rewrite.
 */
export interface CombatOutcome {
  /** Which of the three outcomes occurred. */
  readonly result: CombatResult;
  /** The piece that initiated the attack (side + type), before resolution. */
  readonly attacker: PlacedPiece;
  /** The piece that was attacked (side + type), before resolution. */
  readonly defender: PlacedPiece;
  /** The attacked square - the defender's square, i.e. the move's `to`. */
  readonly square: Square;
  /** True when the defender fell (attacker wins or mutual loss). */
  readonly capture: boolean;
  /** True when Archer defensive support fired, flipping an attacker-wins
   * base result into mutual loss (see `resolveCombat`). */
  readonly archerSupport: boolean;
}

const COLUMN_INDEX: Readonly<Record<Column, number>> = Object.fromEntries(
  COLUMNS.map((column, index) => [column, index]),
) as Record<Column, number>;

/**
 * The straight-line distance, in squares, between two colinear squares (the
 * count of squares between `from` and `to` along their shared row or
 * column). A legal attack's `from`/`to` are always colinear - see
 * `legalAttacks` (Step 3) - so only one of the two deltas is ever non-zero.
 */
function distance(from: Square, to: Square): number {
  const columnDelta = Math.abs(
    COLUMN_INDEX[to.column] - COLUMN_INDEX[from.column],
  );
  const rowDelta = Math.abs(to.row - from.row);
  return Math.max(columnDelta, rowDelta);
}

/**
 * The non-Archer base result of `attacker` (on `from`) attacking `defender`
 * (on `to`), per rules.md §4.3's rank table and special cases:
 *
 * - Assassin attacking: always wins, including Assassin-vs-Assassin -
 *   *except* attacking a Tower, where the Assassin is destroyed instead.
 * - Assassin defending (against a non-Assassin attacker): the attacker
 *   always wins.
 * - Tower defending: only a Sapper destroys it (attacker wins); any other
 *   attacker is removed while the Tower stands (attacker loses).
 * - Knight vs. Knight: a charge (distance >= 2) wins outright for the
 *   attacker; an adjacent (distance 1) attack is mutual loss.
 * - Otherwise, two numbered pieces: the lower rank number wins; equal rank
 *   is mutual loss.
 */
function baseResult(
  attacker: PlacedPiece,
  defender: PlacedPiece,
  from: Square,
  to: Square,
): CombatResult {
  if (attacker.pieceType === "assassin") {
    return defender.pieceType === "tower" ? "attackerLoses" : "attackerWins";
  }

  if (defender.pieceType === "assassin") {
    return "attackerWins";
  }

  if (defender.pieceType === "tower") {
    return attacker.pieceType === "sapper" ? "attackerWins" : "attackerLoses";
  }

  if (attacker.pieceType === "knight" && defender.pieceType === "knight") {
    const isCharge = distance(from, to) >= 2;
    return isCharge ? "attackerWins" : "mutualLoss";
  }

  const attackerRank = PIECE_CATALOG[attacker.pieceType].rankCode;
  const defenderRank = PIECE_CATALOG[defender.pieceType].rankCode;
  if (typeof attackerRank !== "number" || typeof defenderRank !== "number") {
    // Every other case (Assassin, Tower, Flag) is handled above; a legal
    // attack never reaches here with anything but two numbered pieces.
    throw new Error(
      `resolveCombat: unexpected rank codes for ${attacker.pieceType} (${String(attackerRank)}) vs ${defender.pieceType} (${String(defenderRank)}).`,
    );
  }
  if (attackerRank < defenderRank) {
    return "attackerWins";
  }
  if (attackerRank > defenderRank) {
    return "attackerLoses";
  }
  return "mutualLoss";
}

/**
 * The square one step beyond `defenderSquare`, continuing in the direction
 * `dc`/`dr` (the attacker's unit direction of travel) - the Archer support
 * trigger square. Returns `null` if that square is off-board.
 */
function squareBeyond(
  defenderSquare: Square,
  dc: number,
  dr: number,
): Square | null {
  const columnIndex = COLUMN_INDEX[defenderSquare.column] + dc;
  const row = defenderSquare.row + dr;
  if (columnIndex < 0 || columnIndex >= COLUMNS.length) {
    return null;
  }
  if (row < 1 || row > 12) {
    return null;
  }
  return { column: COLUMNS[columnIndex], row: row as Row };
}

/**
 * True if Archer defensive support fires for `defender` (on `to`) against
 * `attacker` (moving from `from`), per rules.md §4.3: a friendly piece
 * adjacent to an Archer loses a defensive combat, and the Archer stands
 * directly opposite the attacker - one square beyond the defender,
 * continuing the attacker's exact straight-line direction of travel (the
 * same geometry for a 1-square attack, a 2-3 square charge, or a rush).
 * Does not fire if that trigger square is off-board, a lake, or does not
 * hold an Archer belonging to the defender's side. Evaluated purely from
 * the defender's side, so it never fires for a piece that is itself
 * attacking (a bystander effect, not an Archer combat buff).
 */
function archerSupportFires(
  board: BoardState,
  from: Square,
  to: Square,
  defender: PlacedPiece,
): boolean {
  const dc = Math.sign(COLUMN_INDEX[to.column] - COLUMN_INDEX[from.column]);
  const dr = Math.sign(to.row - from.row);
  const triggerSquare = squareBeyond(to, dc, dr);
  if (triggerSquare === null || isLake(triggerSquare)) {
    return false;
  }
  const occupant = board[squareKey(triggerSquare)];
  return (
    occupant !== undefined &&
    occupant.side === defender.side &&
    occupant.pieceType === "archer"
  );
}

/**
 * Resolves the encounter for the piece on `from` attacking the enemy piece
 * on `to`, per rules.md §4.3. Infers whether the attack is a Knight's
 * **charge** from the geometry (attacker is a Knight and the straight-line
 * distance from `from` to `to` is >= 2) - callers never pass a charge flag.
 * Implements the full ruleset-1.1 rank table, every non-Archer special case,
 * and the Archer's defensive-support override: when the base result is
 * **attacker wins**, a friendly Archer standing one square beyond the
 * defender on the attacker's exact line of travel flips the result to
 * **mutual loss** (the attacker also falls; the supporting Archer is a
 * bystander and is not removed). Support extends to a supported Tower
 * (which then trades with the Sapper demolishing it) and does not make an
 * attacking Assassin immune - both follow automatically, since each starts
 * as an attacker-wins base result that support flips to mutual.
 *
 * A legal attack always has a piece on both `from` and `to` (see
 * `legalAttacks`, Step 3); this is a programming-invariant function like
 * `applyMove` and throws if either square is empty.
 */
export function resolveCombat(
  board: BoardState,
  from: Square,
  to: Square,
): CombatOutcome {
  const attacker = board[squareKey(from)];
  const defender = board[squareKey(to)];
  if (attacker === undefined) {
    throw new Error(
      `resolveCombat: ${squareKey(from)} holds no piece to attack with.`,
    );
  }
  if (defender === undefined) {
    throw new Error(
      `resolveCombat: ${squareKey(to)} holds no piece to attack.`,
    );
  }

  const base = baseResult(attacker, defender, from, to);
  const archerSupport =
    base === "attackerWins" && archerSupportFires(board, from, to, defender);
  const result = archerSupport ? "mutualLoss" : base;

  return {
    result,
    attacker,
    defender,
    square: to,
    capture: result !== "attackerLoses",
    archerSupport,
  };
}
