// Policy decode, legal mask, and sampling for encoding v1 (spec ENG_NN_1,
// companion capture-the-flag repository, `doc/neuralnetwork/eng-nn-1.md`).
//
// Turns the network's raw `(8, 12, 12)` policy logits into a single chosen
// ply. The rules engine's legal-ply set is always authoritative: only legal
// plies are ever scored, so an illegal or off-board policy index can never be
// selected - this is the invariant the story's correctness rests on. Legal
// logits are turned into a probability distribution via softmax, and one ply
// is sampled from it using an injectable random source.
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
 * Injectable so sampling is deterministic under test (pass a seeded
 * generator, same pattern as `autoFill`'s `RandomSource` in
 * `src/rules/primary/v1/placement.ts`) while defaulting to real randomness
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

/** Every legal ply for `side` on `board`: each of its own pieces' legal destinations and attacks. */
function enumerateLegalPlies(board: BoardState, side: Side): Ply[] {
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

/** The softmax distribution over `logits`, numerically stabilized by subtracting the max. */
function softmax(logits: readonly number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - max));
  const sum = exps.reduce((total, exp) => total + exp, 0);
  return exps.map((exp) => exp / sum);
}

/**
 * Chooses `side`'s ply for this position from the network's raw policy
 * logits: (1) enumerates every legal ply from the rules engine
 * (`legalDestinations` and `legalAttacks` for each of `side`'s own pieces);
 * (2) reads each legal ply's logit out of `policy` via `policyIndexForPly`;
 * (3) takes the softmax over *only* those legal logits (the mask is always
 * authoritative - an illegal or off-board index is never considered, let
 * alone selected); (4) samples one ply from that distribution using `random`.
 *
 * `random` defaults to `Math.random` (real randomness for the UI); pass a
 * seeded `RandomSource` for deterministic, reproducible results in tests.
 *
 * Throws if `side` has no legal ply at all - the game would already be over
 * (`computeOutcome`), so the caller should never ask for a move in a
 * terminal position; returning any ply here would be a silent, invalid
 * fallback rather than a caught programming error.
 */
export function selectEnginePly(
  policy: Float32Array,
  board: BoardState,
  side: Side,
  random: RandomSource = Math.random,
): Ply {
  const legalPlies = enumerateLegalPlies(board, side);
  if (legalPlies.length === 0) {
    throw new Error(
      `selectEnginePly: ${side} has no legal ply - the game must already be over; the caller must not request a move in a terminal position.`,
    );
  }

  const logits = legalPlies.map((ply) => policy[policyIndexForPly(ply, side)]);
  const probabilities = softmax(logits);

  const sample = random();
  let cumulative = 0;
  for (let i = 0; i < legalPlies.length; i += 1) {
    cumulative += probabilities[i];
    if (sample < cumulative) {
      return legalPlies[i];
    }
  }
  // Floating-point rounding can leave `cumulative` a hair under 1 by the
  // final entry; fall back to the last ply so a valid ply is always returned.
  return legalPlies[legalPlies.length - 1];
}
