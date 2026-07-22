// Async engine move selection (story 00000019, Step 4). Ties Step 3's
// in-browser inference (`inference.ts`) to Step 2's decode/mask/sample
// (`src/encoding/eng-nn-1/decoder.ts`), so the play loop (Step 5) has a
// single async seam to call on the computer's turn: "give me the computer's
// ply for this position." Exactly one network evaluation per move - no tree
// search (see story.md's "Raw-policy move selection").
//
// This module never applies the chosen ply itself - the caller does, through
// `applyMove` (`src/rules/primary/v1/play.ts`) - and it only ever returns a
// ply the rules engine already reports legal, since `selectEnginePly` only
// ever samples from the legal set it enumerates from the rules engine.
//
// The network evaluation is an injectable dependency (`PositionEvaluator`)
// so this module is unit-testable without loading WASM: tests pass a fake
// evaluator returning a hand-built policy, while production defaults to
// Step 3's real `evaluatePosition`.

import {
  selectEnginePly,
  type Ply,
  type RandomSource,
} from "../encoding/eng-nn-1/decoder.ts";
import type { Position } from "../encoding/eng-nn-1/encoder.ts";
import type { PlayState } from "../rules/primary/v1/play.ts";
import { evaluatePosition, type EngineEvaluation } from "./inference.ts";

/**
 * Evaluates a position and returns the network's raw value/policy output.
 * Injectable so `chooseEnginePly` is unit-testable without loading WASM:
 * tests pass a fake evaluator returning a hand-built policy. Defaults to
 * Step 3's real `evaluatePosition` in production. May resolve synchronously
 * or asynchronously - `chooseEnginePly` always awaits it.
 */
export type PositionEvaluator = (
  position: Position,
) => EngineEvaluation | Promise<EngineEvaluation>;

/**
 * Chooses the computer's ply for `play`'s current position: runs `evaluate`
 * exactly once (default the real network, Step 3's `evaluatePosition`) and
 * samples a legal ply from the resulting policy via Step 2's
 * `selectEnginePly`, using `random` (default `Math.random`; pass a seeded
 * `RandomSource` for deterministic, reproducible results in tests, same
 * pattern as `autoFill`).
 *
 * This is the single seam the play loop (Step 5) calls on the computer's
 * turn. It never applies the move - the caller does, through `applyMove` -
 * and, because `selectEnginePly` only ever samples from the legal plies the
 * rules engine reports for `play.board`/`play.sideToMove`, the returned ply
 * is always legal; an illegal or off-board move can never come back.
 */
export async function chooseEnginePly(
  play: PlayState,
  evaluate: PositionEvaluator = evaluatePosition,
  random: RandomSource = Math.random,
): Promise<Ply> {
  const position: Position = {
    board: play.board,
    sideToMove: play.sideToMove,
    inactivityCounter: play.inactivityCounter,
  };
  const { policy } = await evaluate(position);
  return selectEnginePly(policy, play.board, play.sideToMove, random);
}
