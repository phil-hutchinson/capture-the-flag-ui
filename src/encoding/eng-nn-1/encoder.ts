// Board-state encoder for encoding v1 (spec ENG_NN_1, companion
// capture-the-flag repository, `doc/neuralnetwork/eng-nn-1.md`). Turns a
// position - a `BoardState`, the side to move, and the shared inactivity
// counter - into the network's `(18, 12, 12)` input tensor, from the mover's
// perspective, as a flat `Float32Array`.
//
// This module is pure - no React, no onnxruntime - and builds only on the
// rules engine's board geometry/state (`src/rules/primary/v1/`) and this
// folder's shared coordinate transform and plane constants (`shared.ts`).

import {
  allSquares,
  isLake,
  squareKey,
  type Side,
} from "../../rules/primary/v1/board.ts";
import type { BoardState } from "../../rules/primary/v1/gameState.ts";
import { INACTIVITY_LIMIT } from "../../rules/primary/v1/outcome.ts";
import {
  flatIndex,
  INACTIVITY_PLANE,
  INPUT_LENGTH,
  MOVER_PLANE_OFFSET,
  OPPONENT_PLANE_OFFSET,
  PASSABLE_PLANE,
  PIECE_PLANE_INDEX,
  TENSOR_SIZE,
  toMoverFrame,
} from "./shared.ts";

/** The position ENG_NN_1 encodes: a board, whose turn it is, and the shared inactivity counter. */
export interface Position {
  readonly board: BoardState;
  readonly sideToMove: Side;
  readonly inactivityCounter: number;
}

/** The encoded `(1, 18, 12, 12)` input tensor, ready to feed to the model. */
export interface EncodedInput {
  /** Flat `Float32Array` of length 2592, in `(plane, row, col)` row-major order. */
  readonly data: Float32Array;
  /** The batch-of-one shape the model expects. */
  readonly dims: readonly [1, 18, 12, 12];
}

/**
 * Encodes `position` into the ENG_NN_1 `(18, 12, 12)` input tensor, from
 * `position.sideToMove`'s perspective: planes 0-7 are the mover's own pieces,
 * 8-15 the opponent's (both in `shared.ts`'s `PLANE_PIECE_ORDER`), plane 16
 * marks passable squares (0 on the 12 lake squares), and plane 17 carries the
 * inactivity counter as a uniform fraction of `INACTIVITY_LIMIT`.
 */
export function encodePosition(position: Position): EncodedInput {
  const { board, sideToMove, inactivityCounter } = position;
  const data = new Float32Array(INPUT_LENGTH);

  for (const square of allSquares()) {
    const { row, col } = toMoverFrame(square, sideToMove);

    const piece = board[squareKey(square)];
    if (piece !== undefined) {
      const groupOffset =
        piece.side === sideToMove ? MOVER_PLANE_OFFSET : OPPONENT_PLANE_OFFSET;
      const plane = groupOffset + PIECE_PLANE_INDEX[piece.pieceType];
      data[flatIndex(plane, row, col)] = 1;
    }

    data[flatIndex(PASSABLE_PLANE, row, col)] = isLake(square) ? 0 : 1;
  }

  const inactivityValue = inactivityCounter / INACTIVITY_LIMIT;
  for (let row = 0; row < TENSOR_SIZE; row++) {
    for (let col = 0; col < TENSOR_SIZE; col++) {
      data[flatIndex(INACTIVITY_PLANE, row, col)] = inactivityValue;
    }
  }

  return { data, dims: [1, 18, 12, 12] };
}
