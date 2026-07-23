// Policy decode and legal-ply enumeration for encoding v1 (spec ENG_NN_1,
// companion capture-the-flag repository, `doc/neuralnetwork/eng-nn-1.md`).
//
// Maps between a ply and its flat index into the network's raw `(8, 12, 12)`
// policy tensor (`policyIndexForPly`), and enumerates every legal ply for a
// side (`enumerateLegalPlies`) straight from the rules engine's own
// movement generation - the rules engine's legal-ply set is always
// authoritative, so an illegal or off-board policy index is never even
// considered by a caller built on this module. The PUCT search
// (`src/engine/search.ts`) is this module's production consumer: it expands
// each node against `enumerateLegalPlies` and scores each candidate via
// `policyIndexForPly`.
//
// This module is pure - no React, no onnxruntime - and builds only on the
// rules engine's movement generation (`src/rules/primary/v1/movement.ts`)
// and this folder's shared coordinate transform (`shared.ts`); its mapping
// must stay in lock-step with `encoder.ts`'s, since both walk the same
// mover-perspective frame.

import {
  allSquares,
  squareKey,
  type Side,
  type Square,
} from "../../rules/primary/v1/board.ts";
import type { BoardState } from "../../rules/primary/v1/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../../rules/primary/v1/movement.ts";
import {
  flatIndex,
  MOVEMENT_INDEX_COUNT,
  POLICY_LENGTH,
  toMoverFrame,
  type TensorCoords,
} from "./shared.ts";

// Re-exported for existing callers/tests that import these shape constants
// from the decoder; `shared.ts` is the single source of truth (see Finding 1
// of the peer review).
export { MOVEMENT_INDEX_COUNT, POLICY_LENGTH };

/**
 * A source of numbers in `[0, 1)`, matching the shape of `Math.random`.
 * Injectable so callers (e.g. the PUCT search's tie-breaking and sampling,
 * `src/engine/search.ts`) are deterministic under test - pass a seeded
 * generator, same pattern as `autoFill`'s `RandomSource` in
 * `src/rules/primary/v1/placement.ts` - while defaulting to real randomness
 * in production.
 */
export type RandomSource = () => number;

/** One candidate ply: a piece's origin square and where it would go. */
export interface Ply {
  readonly from: Square;
  readonly to: Square;
}

/**
 * The tensor-frame `(dRow, dCol)` offset for each of the 8 movement indices,
 * per ENG_NN_1: one- and two-square orthogonal steps in the mover's frame,
 * where increasing row is the direction the mover advances (index-aligned
 * with the movement index itself, 0-7).
 */
export const MOVEMENT_OFFSETS: readonly {
  readonly dRow: number;
  readonly dCol: number;
}[] = [
  { dRow: 1, dCol: 0 }, // 0: up one
  { dRow: 0, dCol: 1 }, // 1: right one
  { dRow: -1, dCol: 0 }, // 2: down one
  { dRow: 0, dCol: -1 }, // 3: left one
  { dRow: 2, dCol: 0 }, // 4: up two
  { dRow: 0, dCol: 2 }, // 5: right two
  { dRow: -2, dCol: 0 }, // 6: down two
  { dRow: 0, dCol: -2 }, // 7: left two
];

/** The movement index whose offset is exactly `(dRow, dCol)`, or `undefined` if none matches. */
function movementIndexForOffset(
  dRow: number,
  dCol: number,
): number | undefined {
  const index = MOVEMENT_OFFSETS.findIndex(
    (offset) => offset.dRow === dRow && offset.dCol === dCol,
  );
  return index === -1 ? undefined : index;
}

/**
 * The flat policy index for `ply`, in `mover`'s tensor frame: `ply.from` maps
 * to its tensor `(row, col)` (`toMoverFrame`), the offset to `ply.to` selects
 * the movement index, and `flatIndex` combines them exactly as ENG_NN_1
 * specifies (`movementIndex * 144 + tensorRow * 12 + tensorCol` - the same
 * formula `flatIndex`'s `plane` parameter already computes, reused here with
 * the movement index standing in for a plane). Throws if the ply's offset
 * does not match one of the eight movement indices - every legal ply from the
 * rules engine is one or two squares orthogonally, so this should never
 * happen for a legal ply; a thrown error here indicates the rules engine and
 * ENG_NN_1's movement-index table have drifted apart.
 */
export function policyIndexForPly(ply: Ply, mover: Side): number {
  const from: TensorCoords = toMoverFrame(ply.from, mover);
  const to: TensorCoords = toMoverFrame(ply.to, mover);
  const dRow = to.row - from.row;
  const dCol = to.col - from.col;
  const movementIndex = movementIndexForOffset(dRow, dCol);
  if (movementIndex === undefined) {
    throw new Error(
      `policyIndexForPly: ${squareKey(ply.from)}->${squareKey(ply.to)} does not match any ENG_NN_1 movement-index offset (dRow=${dRow}, dCol=${dCol}).`,
    );
  }
  return flatIndex(movementIndex, from.row, from.col);
}

/**
 * Every legal ply for `side` on `board`: each of its own pieces' legal
 * destinations and attacks. Exported (story 00000021, Step 1) so the PUCT
 * search (`src/engine/search.ts`) expands a node against exactly this same
 * legal set - one shared enumeration, never two copies that could drift
 * apart.
 */
export function enumerateLegalPlies(board: BoardState, side: Side): Ply[] {
  const plies: Ply[] = [];
  for (const origin of allSquares()) {
    const occupant = board[squareKey(origin)];
    if (occupant === undefined || occupant.side !== side) {
      continue;
    }
    for (const to of legalDestinations(board, origin)) {
      plies.push({ from: origin, to });
    }
    for (const to of legalAttacks(board, origin)) {
      plies.push({ from: origin, to });
    }
  }
  return plies;
}
