// Combat resolution rule logic for ruleset 1.2, §4.3 (companion
// capture-the-flag repository, `doc/ruleset/rules.md`, the single source of
// truth).
//
// Attacking is moving a piece onto an enemy-occupied square (movement.ts's
// `legalAttacks` decides *which* squares qualify). This module resolves what
// happens once an attack is chosen: the rank table, equal-rank mutual loss,
// the Tower trade (any attacker trades with a Tower), the Flag capture (an
// outright win), and the **formation bonus** - a friendly piece of equal
// rank standing beside a piece turns what would otherwise be a clean loss,
// for the weaker side only, into a mutual loss. There are no other special
// cases in 1.2: no charge, no rush, no defensive support, no Sapper-only
// tower destruction, no Assassin rules.
//
// This module is pure rule logic - no React - and builds only on the board
// geometry (board.ts), the piece catalog (pieces.ts), and `BoardState`
// (gameState.ts); it has no further dependencies.

import {
  COLUMNS,
  ROWS,
  squareKey,
  type Column,
  type Row,
  type Side,
  type Square,
} from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { PIECE_CATALOG } from "./pieces.ts";

/** The three possible resolutions of an encounter, per rules.md §4.3. */
export type CombatResult = "attackerWins" | "attackerLoses" | "mutualLoss";

/**
 * A fully resolved encounter: which pieces fought, where, and what happened.
 * Carries enough for the UI announcement and for `outcome.ts`'s game-end
 * detection (flag capture, the shared inactivity counter) to consume without
 * a rewrite.
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
}

const COLUMN_INDEX: Readonly<Record<Column, number>> = Object.fromEntries(
  COLUMNS.map((column, index) => [column, index]),
) as Record<Column, number>;

/** The eight squares surrounding a square (orthogonal and diagonal), used
 * only to judge the formation bonus. */
const SURROUNDING_DIRECTIONS: readonly { dc: number; dr: number }[] = [
  { dc: -1, dr: -1 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
  { dc: -1, dr: 1 },
  { dc: 0, dr: 1 },
  { dc: 1, dr: 1 },
];

/** The square one step from `square` in direction `dc`/`dr`, or `null` if off-board. */
function step(square: Square, dc: number, dr: number): Square | null {
  const columnIndex = COLUMN_INDEX[square.column] + dc;
  const row = square.row + dr;
  if (columnIndex < 0 || columnIndex >= COLUMNS.length) {
    return null;
  }
  if (!ROWS.includes(row as Row)) {
    return null;
  }
  return { column: COLUMNS[columnIndex], row: row as Row };
}

/**
 * True if a piece of `side` and `rank` standing on `square` has the
 * **formation bonus** per rules.md §4.3: a friendly piece of equal rank
 * occupies one of its eight surrounding squares (orthogonal or diagonal).
 * Only ranked pieces (Tower and Flag have no rank) ever have the bonus.
 */
function hasFormationBonus(
  board: BoardState,
  square: Square,
  side: Side,
  rank: number,
): boolean {
  for (const { dc, dr } of SURROUNDING_DIRECTIONS) {
    const neighbor = step(square, dc, dr);
    if (neighbor === null) {
      continue;
    }
    const occupant = board[squareKey(neighbor)];
    if (
      occupant !== undefined &&
      occupant.side === side &&
      PIECE_CATALOG[occupant.pieceType].rankCode === rank
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the encounter for the piece on `from` attacking the enemy piece
 * on `to`, per rules.md §4.3:
 *
 * - A **Flag** defending always falls - the attacker wins outright, whatever
 *   attacked it (§6.1, flag capture).
 * - A **Tower** defending is always a mutual loss - any attacker trades with
 *   it.
 * - Otherwise both pieces are ranked: the lower rank number (stronger) wins;
 *   equal rank is a mutual loss. The **formation bonus** then applies: judged
 *   for the attacker from its origin square (`from`, before it moves) and
 *   for the defender from its own square (`to`, at the moment it is
 *   attacked). When the two ranks differ by exactly one, the weaker piece
 *   (higher rank number) - if it has the formation bonus - turns its clean
 *   loss into a mutual loss. This only ever turns a would-be clean win/loss
 *   into a mutual loss; it never applies at a rank gap of zero or two-or-more,
 *   and it never turns a mutual loss back into a win.
 *
 * A legal attack always has a piece on both `from` and `to` (see
 * `legalAttacks`); this is a programming-invariant function like `applyMove`
 * and throws if either square is empty.
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

  const result = baseResult(board, attacker, defender, from, to);

  return {
    result,
    attacker,
    defender,
    square: to,
    capture: result !== "attackerLoses",
  };
}

/**
 * The full combat result for `attacker` (on `from`) attacking `defender` (on
 * `to`) - the rank table, the Tower and Flag special cases, and the
 * formation-bonus adjustment. See `resolveCombat`'s doc comment for the
 * rules; this is a free function only so the two concerns (looking up the
 * pieces vs. resolving them) stay separately readable.
 */
function baseResult(
  board: BoardState,
  attacker: PlacedPiece,
  defender: PlacedPiece,
  from: Square,
  to: Square,
): CombatResult {
  if (defender.pieceType === "flag") {
    return "attackerWins";
  }

  if (defender.pieceType === "tower") {
    return "mutualLoss";
  }

  const attackerRank = PIECE_CATALOG[attacker.pieceType].rankCode;
  const defenderRank = PIECE_CATALOG[defender.pieceType].rankCode;
  if (typeof attackerRank !== "number" || typeof defenderRank !== "number") {
    // Tower and Flag are handled above (as defenders); Tower never attacks
    // (it never moves), so a legal attack never reaches here with anything
    // but two ranked pieces.
    throw new Error(
      `resolveCombat: unexpected rank codes for ${attacker.pieceType} (${String(attackerRank)}) vs ${defender.pieceType} (${String(defenderRank)}).`,
    );
  }

  if (attackerRank === defenderRank) {
    return "mutualLoss";
  }

  if (attackerRank < defenderRank) {
    // Attacker is stronger - wins outright, unless the one-rank-weaker
    // defender has the formation bonus.
    const defenderIsOneRankWeaker = defenderRank === attackerRank + 1;
    if (
      defenderIsOneRankWeaker &&
      hasFormationBonus(board, to, defender.side, defenderRank)
    ) {
      return "mutualLoss";
    }
    return "attackerWins";
  }

  // Attacker is weaker - loses outright, unless it is exactly one rank
  // weaker and has the formation bonus itself (judged from its origin).
  const attackerIsOneRankWeaker = attackerRank === defenderRank + 1;
  if (
    attackerIsOneRankWeaker &&
    hasFormationBonus(board, from, attacker.side, attackerRank)
  ) {
    return "mutualLoss";
  }
  return "attackerLoses";
}
