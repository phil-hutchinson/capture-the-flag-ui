// Shared coordinate transform and plane-order constants for encoding v1
// (spec ENG_NN_1, companion capture-the-flag repository,
// `doc/neuralnetwork/eng-nn-1.md`). Used by both the input encoder
// (`encoder.ts`, Step 1) and the policy decoder (Step 2), so the two stay in
// lock-step: a ply's source square must land on the identical tensor cell in
// both directions.
//
// This module is pure geometry/data - no React, no rules-engine mutation -
// and depends only on the board geometry (`src/rules/primary/v1/board.ts`)
// and the piece catalog (`src/rules/primary/v1/pieces.ts`).

import {
  COLUMNS,
  type Side,
  type Square,
} from "../../rules/primary/v1/board.ts";
import type { PieceTypeId } from "../../rules/primary/v1/pieces.ts";

/** The tensor is always 12x12 in (row, col), per ENG_NN_1. */
export const TENSOR_SIZE = 12;

/** Total plane count: 8 mover + 8 opponent + passable + inactivity. */
export const PLANE_COUNT = 18;

/** Flat length of the (18, 12, 12) input tensor. */
export const INPUT_LENGTH = PLANE_COUNT * TENSOR_SIZE * TENSOR_SIZE;

/**
 * Number of policy movement planes: the one- and two-square orthogonal
 * offsets, per ENG_NN_1. The single source of truth for the policy head's
 * shape - both the decoder (`decoder.ts`) and the in-browser inference
 * boundary (`src/engine/inference.ts`) import it from here rather than
 * re-deriving it, so a future encoding-shape change only needs one edit.
 */
export const MOVEMENT_INDEX_COUNT = 8;

/** Flat length of the `(8, 12, 12)` policy array. */
export const POLICY_LENGTH = MOVEMENT_INDEX_COUNT * TENSOR_SIZE * TENSOR_SIZE;

/** Plane 0 of the mover's own 8 piece planes (planes 0-7). */
export const MOVER_PLANE_OFFSET = 0;

/** Plane 0 of the opponent's 8 piece planes (planes 8-15). */
export const OPPONENT_PLANE_OFFSET = 8;

/** Plane 16: 1 for passable squares, 0 for the 12 lake squares. */
export const PASSABLE_PLANE = 16;

/** Plane 17: uniform inactivity-counter fraction. */
export const INACTIVITY_PLANE = 17;

/**
 * The ENG_NN_1 piece-plane order, within each 8-plane group (mover's own or
 * the opponent's). This is the encoder's own order and is deliberately
 * distinct from `PIECE_TYPES` (`src/rules/primary/v1/pieces.ts`), which lists
 * the ranked pieces first and Tower/Flag last.
 */
export const PLANE_PIECE_ORDER: readonly PieceTypeId[] = [
  "flag",
  "tower",
  "masterOfArms",
  "champion",
  "knight",
  "halberdier",
  "footSoldier",
  "militia",
];

/** Reverse lookup: piece type id -> its index (0-7) within an 8-plane group. */
export const PIECE_PLANE_INDEX: Readonly<Record<PieceTypeId, number>> =
  Object.fromEntries(
    PLANE_PIECE_ORDER.map((id, index) => [id, index]),
  ) as Record<PieceTypeId, number>;

/** A tensor-frame cell, `(row, col)`, both in `[0, 12)`. */
export interface TensorCoords {
  readonly row: number;
  readonly col: number;
}

/**
 * Maps a board `Square` (White's absolute frame) to its `(row, col)` cell in
 * the tensor frame of the given `mover`, per ENG_NN_1's mover-perspective
 * 180-degree rotation:
 *
 * - White to move: `row = boardRow - 1`, `col = columnIndex` (A=0 ... L=11).
 * - Black to move: `row = 12 - boardRow`, `col = 11 - columnIndex`.
 *
 * The mover's own back rank is always tensor row 0, and the mover advances
 * toward increasing row.
 */
export function toMoverFrame(square: Square, mover: Side): TensorCoords {
  const columnIndex = COLUMNS.indexOf(square.column);
  if (mover === "white") {
    return { row: square.row - 1, col: columnIndex };
  }
  return { row: 12 - square.row, col: 11 - columnIndex };
}

/** The flat index of tensor cell `(plane, row, col)` in the length-2592 array. */
export function flatIndex(plane: number, row: number, col: number): number {
  return plane * TENSOR_SIZE * TENSOR_SIZE + row * TENSOR_SIZE + col;
}
