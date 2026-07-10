// Placement state model & core operations for ruleset PRIMARY:1.1.
//
// A `PlacementState` tracks one player's in-progress army layout: which of
// that player's own 48 home squares hold a placed piece type, plus the
// derived remaining-inventory (how many of each type are still in the tray).
// Operations are pure and immutable-style - each returns a *new* state
// rather than mutating its input - so the UI (Steps 8-10) can drive them
// directly and the serializer (Step 5) can read a snapshot safely.
//
// All operations structurally reject any square that is not one of the
// state's own side's home squares (lakes, buffers, and the opponent's zone
// are illegal), and `place` respects remaining counts (cannot place a type
// with zero remaining). Because the UI (Step 7 onward) only ever offers the
// player's own home squares as interactive targets, these are treated as
// programming-invariant violations rather than recoverable user errors:
// violating them throws, rather than silently no-op'ing.
//
// This module builds on the board geometry (Step 1) and the piece catalog /
// fresh-army inventory (Step 2); it has no further dependencies.

import { isHomeSquareFor, squareKey, type Side, type Square } from "./board.ts";
import {
  ARMY_SIZE,
  freshInventory,
  type Inventory,
  type PieceTypeId,
} from "./pieces.ts";

/**
 * One player's in-progress (or complete) army layout: a mapping from that
 * player's home squares (by `squareKey`) to the piece type placed there, and
 * the derived remaining-inventory. Squares absent from `placements` are
 * empty.
 */
export interface PlacementState {
  readonly side: Side;
  readonly placements: ReadonlyMap<string, PieceTypeId>;
  readonly remaining: Inventory;
}

/** A fresh placement state for `side`: no pieces placed, a full 48-piece tray. */
export function emptyPlacement(side: Side): PlacementState {
  return {
    side,
    placements: new Map(),
    remaining: freshInventory(),
  };
}

function assertOwnHomeSquare(
  state: PlacementState,
  square: Square,
  action: string,
): void {
  if (!isHomeSquareFor(square, state.side)) {
    throw new Error(
      `Cannot ${action}: ${squareKey(square)} is not a home square for ${state.side}.`,
    );
  }
}

/** The piece type placed on `square`, or `undefined` if it is empty. */
export function pieceAt(
  state: PlacementState,
  square: Square,
): PieceTypeId | undefined {
  return state.placements.get(squareKey(square));
}

/**
 * Places `pieceType` on `square`. Rejects (throws) if `square` is not one of
 * `state.side`'s own home squares, if `square` is already occupied, or if
 * there is no remaining piece of `pieceType` left in the tray.
 */
export function place(
  state: PlacementState,
  square: Square,
  pieceType: PieceTypeId,
): PlacementState {
  assertOwnHomeSquare(state, square, "place a piece");
  const key = squareKey(square);
  if (state.placements.has(key)) {
    throw new Error(`Cannot place a piece: ${key} is already occupied.`);
  }
  if (state.remaining[pieceType] <= 0) {
    throw new Error(`Cannot place a piece: no ${pieceType} remaining.`);
  }

  const placements = new Map(state.placements);
  placements.set(key, pieceType);
  const remaining: Inventory = {
    ...state.remaining,
    [pieceType]: state.remaining[pieceType] - 1,
  };
  return { ...state, placements, remaining };
}

/**
 * Moves the piece on `from` to `to`. Rejects (throws) if either square is not
 * one of `state.side`'s own home squares, if `from` is empty, or if `to` is
 * already occupied. Remaining counts are unaffected - a move never changes
 * the tray.
 */
export function move(
  state: PlacementState,
  from: Square,
  to: Square,
): PlacementState {
  assertOwnHomeSquare(state, from, "move a piece");
  assertOwnHomeSquare(state, to, "move a piece");
  const fromKey = squareKey(from);
  const toKey = squareKey(to);
  const pieceType = state.placements.get(fromKey);
  if (pieceType === undefined) {
    throw new Error(`Cannot move a piece: ${fromKey} is empty.`);
  }
  if (state.placements.has(toKey)) {
    throw new Error(`Cannot move a piece: ${toKey} is already occupied.`);
  }

  const placements = new Map(state.placements);
  placements.delete(fromKey);
  placements.set(toKey, pieceType);
  return { ...state, placements };
}

/**
 * Swaps the pieces on `squareA` and `squareB`. Rejects (throws) if either
 * square is not one of `state.side`'s own home squares, or if either square
 * is empty (both must already hold a placed piece). Remaining counts are
 * unaffected - a swap never changes the tray.
 */
export function swap(
  state: PlacementState,
  squareA: Square,
  squareB: Square,
): PlacementState {
  assertOwnHomeSquare(state, squareA, "swap pieces");
  assertOwnHomeSquare(state, squareB, "swap pieces");
  const keyA = squareKey(squareA);
  const keyB = squareKey(squareB);
  const pieceA = state.placements.get(keyA);
  const pieceB = state.placements.get(keyB);
  if (pieceA === undefined || pieceB === undefined) {
    throw new Error("Cannot swap pieces: both squares must be occupied.");
  }

  const placements = new Map(state.placements);
  placements.set(keyA, pieceB);
  placements.set(keyB, pieceA);
  return { ...state, placements };
}

/**
 * Returns the piece on `square` to the tray, incrementing its remaining
 * count. Rejects (throws) if `square` is not one of `state.side`'s own home
 * squares, or if `square` is empty.
 */
export function returnToTray(
  state: PlacementState,
  square: Square,
): PlacementState {
  assertOwnHomeSquare(state, square, "return a piece to the tray");
  const key = squareKey(square);
  const pieceType = state.placements.get(key);
  if (pieceType === undefined) {
    throw new Error(`Cannot return a piece to the tray: ${key} is empty.`);
  }

  const placements = new Map(state.placements);
  placements.delete(key);
  const remaining: Inventory = {
    ...state.remaining,
    [pieceType]: state.remaining[pieceType] + 1,
  };
  return { ...state, placements, remaining };
}

/** Clears the whole board: returns every placed piece to the tray. */
export function clear(state: PlacementState): PlacementState {
  return emptyPlacement(state.side);
}

/** How many of `pieceType` remain in `state`'s tray. */
export function remainingCount(
  state: PlacementState,
  pieceType: PieceTypeId,
): number {
  return state.remaining[pieceType];
}

/** How many pieces are currently placed on the board (out of `ARMY_SIZE`). */
export function placedCount(state: PlacementState): number {
  return state.placements.size;
}

export interface PlacementProgress {
  readonly placed: number;
  readonly total: number;
}

/** Placement progress as `{ placed, total }`, e.g. for a "42 / 48 placed" readout. */
export function progress(state: PlacementState): PlacementProgress {
  return { placed: placedCount(state), total: ARMY_SIZE };
}

/** True only once every one of the 48 home squares holds a placed piece. */
export function isComplete(state: PlacementState): boolean {
  return placedCount(state) === ARMY_SIZE;
}
