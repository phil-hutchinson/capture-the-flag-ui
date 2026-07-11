// Phase 2 play-state model & move application for ruleset PRIMARY:1.1.
//
// A `PlayState` tracks an in-progress Phase-2 game: the current board, whose
// turn it is to move, and the ordered list of moves made so far in the
// simple `A2A3` coordinate form (source square immediately followed by
// destination square, no separator - rules.md §4.4). This is the minimum
// structure recorded-game replay can build on later; this story does not
// implement replay itself.
//
// Operations are pure and immutable-style - `applyMove` returns a *new*
// state rather than mutating its input - matching placement.ts. Because the
// UI only ever offers legal destinations (structural prevention), `applyMove`
// treats an illegal move as a programming-invariant violation: it throws
// rather than silently no-op'ing.
//
// This module builds on the board geometry (board.ts), the movement rules
// (movement.ts, story 00000004 Step 1), and the initial-game-state artifact
// (gameState.ts, story 00000001); it has no further dependencies.

import { squareKey, type Side, type Square } from "./board.ts";
import type { BoardState, InitialGameState, PlacedPiece } from "./gameState.ts";
import { legalDestinations } from "./movement.ts";

/** The side that moves first, per rules.md §4.1 (White/Red moves first). */
const FIRST_SIDE: Side = "white";

/**
 * An in-progress Phase-2 game: the ruleset it was played under, the current
 * board, whose turn it is, and every move made so far, in order, as `A2A3`
 * coordinate strings (absolute White frame - see board.ts).
 */
export interface PlayState {
  readonly ruleset: string;
  readonly board: BoardState;
  readonly sideToMove: Side;
  readonly moves: readonly string[];
}

/**
 * The opening `PlayState` for `initial` (story 00000001's completed-placement
 * artifact): the same board, White (Red) to move first, no moves made yet,
 * and the ruleset carried over unchanged.
 */
export function startPlay(initial: InitialGameState): PlayState {
  return {
    ruleset: initial.ruleset,
    board: initial.board,
    sideToMove: FIRST_SIDE,
    moves: [],
  };
}

const OTHER_SIDE: Readonly<Record<Side, Side>> = {
  white: "black",
  black: "white",
};

/**
 * Applies a single ply, moving the piece on `from` to `to`, and returns a
 * *new* `PlayState` (the input is never mutated): the piece moves, the side
 * to move flips, and the move is appended as its `A2A3` coordinate string
 * (`squareKey(from) + squareKey(to)`). Rejects (throws) if `from` does not
 * hold a piece belonging to `state.sideToMove`, or if `to` is not among
 * `legalDestinations(state.board, from)` - the UI never offers an illegal
 * move, so this is a programming-invariant guard, not a user-facing error.
 */
export function applyMove(
  state: PlayState,
  from: Square,
  to: Square,
): PlayState {
  const fromKey = squareKey(from);
  const toKey = squareKey(to);
  const piece = state.board[fromKey];
  if (piece === undefined || piece.side !== state.sideToMove) {
    throw new Error(
      `Cannot apply move: ${fromKey} does not hold a piece belonging to ${state.sideToMove}.`,
    );
  }

  const legal = legalDestinations(state.board, from);
  if (!legal.some((square) => squareKey(square) === toKey)) {
    throw new Error(
      `Cannot apply move: ${toKey} is not a legal destination for the piece on ${fromKey}.`,
    );
  }

  const board: Record<string, PlacedPiece> = { ...state.board };
  delete board[fromKey];
  board[toKey] = piece;

  return {
    ...state,
    board,
    sideToMove: OTHER_SIDE[state.sideToMove],
    moves: [...state.moves, fromKey + toKey],
  };
}
