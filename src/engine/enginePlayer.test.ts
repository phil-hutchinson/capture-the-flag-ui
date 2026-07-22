import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  allSquares,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1/board.ts";
import { buildInitialGameState } from "../rules/primary/v1/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v1/movement.ts";
import {
  autoFill,
  emptyPlacement,
  type RandomSource as PlacementRandomSource,
} from "../rules/primary/v1/placement.ts";
import {
  applyMove,
  startPlay,
  type PlayState,
} from "../rules/primary/v1/play.ts";
import {
  POLICY_LENGTH,
  policyIndexForPly,
  type Ply,
  type RandomSource,
} from "../encoding/eng-nn-1/decoder.ts";
import { chooseEnginePly, type PositionEvaluator } from "./enginePlayer.ts";

/**
 * A tiny seeded linear-congruential generator, used only so tests can assert
 * reproducibility with a fixed seed without depending on `Math.random`.
 * Matches the pattern used in `src/rules/primary/v1/placement.test.ts` and
 * `src/encoding/eng-nn-1/decoder.test.ts`.
 */
function seededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** A seeded `RandomSource` compatible with `autoFill`'s own type (same LCG as `seededRandom`). */
function seededRandomForPlacement(seed: number): PlacementRandomSource {
  return seededRandom(seed);
}

/** Every legal ply for `side` on `board`, recomputed directly from the rules engine's own API. */
function legalPliesFor(board: PlayState["board"], side: Side): Ply[] {
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

/** True if `plies` contains a ply with the same `from`/`to` squares as `ply`. */
function containsPly(plies: readonly Ply[], ply: Ply): boolean {
  return plies.some(
    (candidate) =>
      squareKey(candidate.from) === squareKey(ply.from) &&
      squareKey(candidate.to) === squareKey(ply.to),
  );
}

/** True only if `square` names a real board cell (a `COLUMNS` letter and a row 1-12). */
function isOnBoard(square: Square): boolean {
  return COLUMNS.includes(square.column) && square.row >= 1 && square.row <= 12;
}

/**
 * Plays up to `plyCount` random plies (picked by `random` from the rules
 * engine's own legal set - not `chooseEnginePly` - to build the position
 * independently of the module under test) from `play`, stopping early if the
 * game ends or the side to move has no legal ply. Used to build a spread of
 * ongoing mid-game positions, both sides to move.
 */
function advanceRandomPlies(
  play: PlayState,
  plyCount: number,
  random: RandomSource,
): PlayState {
  let state = play;
  for (let i = 0; i < plyCount; i += 1) {
    if (state.result.kind !== "ongoing") {
      break;
    }
    const legal = legalPliesFor(state.board, state.sideToMove);
    if (legal.length === 0) {
      break;
    }
    const index = Math.min(
      legal.length - 1,
      Math.floor(random() * legal.length),
    );
    const ply = legal[index];
    state = applyMove(state, ply.from, ply.to).state;
  }
  return state;
}

/** A handful of ongoing mid-game `PlayState`s, built from seeded `autoFill` armies and a few random plies. */
function midGamePositions(): PlayState[] {
  const positions: PlayState[] = [];
  const placementSeeds = [1, 17, 203, 44, 8];
  const plyCounts = [0, 3, 6, 10, 15];

  for (const seed of placementSeeds) {
    const white = autoFill(
      emptyPlacement("white"),
      seededRandomForPlacement(seed),
    );
    const black = autoFill(
      emptyPlacement("black"),
      seededRandomForPlacement(seed * 31 + 7),
    );
    const initial = buildInitialGameState(white, black);
    const play = startPlay(initial);

    for (const plyCount of plyCounts) {
      const advanced = advanceRandomPlies(
        play,
        plyCount,
        seededRandom(seed * 997 + plyCount),
      );
      if (
        advanced.result.kind === "ongoing" &&
        legalPliesFor(advanced.board, advanced.sideToMove).length > 0
      ) {
        positions.push(advanced);
      }
    }
  }

  return positions;
}

/** A fake `PositionEvaluator` returning a fixed, hand-built policy - no inference, no WASM. */
function fixedPolicyEvaluator(policy: Float32Array): PositionEvaluator {
  return () => ({ value: 0, policy });
}

/** A hand-built policy with all its mass on `ply`'s flat index (from `mover`'s frame). */
function allMassOn(ply: Ply, mover: Side): Float32Array {
  const policy = new Float32Array(POLICY_LENGTH);
  policy[policyIndexForPly(ply, mover)] = 1000;
  return policy;
}

/** A pseudo-random-looking policy, deterministic in `seed`, spread across the full range (like `decoder.test.ts`'s). */
function pseudoRandomPolicy(seed: number): Float32Array {
  const policy = new Float32Array(POLICY_LENGTH);
  const random = seededRandom(seed);
  for (let i = 0; i < POLICY_LENGTH; i += 1) {
    policy[i] = random() * 20 - 10;
  }
  return policy;
}

describe("chooseEnginePly", () => {
  it("resolves to the one legal ply the policy puts all its mass on, and it is in the engine's legal set", async () => {
    const white = autoFill(
      emptyPlacement("white"),
      seededRandomForPlacement(5),
    );
    const black = autoFill(
      emptyPlacement("black"),
      seededRandomForPlacement(9),
    );
    const play = startPlay(buildInitialGameState(white, black));

    const legal = legalPliesFor(play.board, play.sideToMove);
    expect(legal.length).toBeGreaterThan(0);
    const targetPly = legal[0];

    const chosen = await chooseEnginePly(
      play,
      fixedPolicyEvaluator(allMassOn(targetPly, play.sideToMove)),
      () => 0.5,
    );

    expect(chosen).toEqual(targetPly);
    expect(containsPly(legal, chosen)).toBe(true);
  });

  it("calls the evaluator exactly once per move", async () => {
    const white = autoFill(
      emptyPlacement("white"),
      seededRandomForPlacement(2),
    );
    const black = autoFill(
      emptyPlacement("black"),
      seededRandomForPlacement(3),
    );
    const play = startPlay(buildInitialGameState(white, black));

    let calls = 0;
    const evaluate: PositionEvaluator = (position) => {
      calls += 1;
      expect(position.board).toBe(play.board);
      expect(position.sideToMove).toBe(play.sideToMove);
      expect(position.inactivityCounter).toBe(play.inactivityCounter);
      return { value: 0, policy: pseudoRandomPolicy(1) };
    };

    await chooseEnginePly(play, evaluate, seededRandom(1));
    expect(calls).toBe(1);
  });

  it("accepts an async evaluator (resolving a Promise) as well as a sync one", async () => {
    const white = autoFill(
      emptyPlacement("white"),
      seededRandomForPlacement(11),
    );
    const black = autoFill(
      emptyPlacement("black"),
      seededRandomForPlacement(13),
    );
    const play = startPlay(buildInitialGameState(white, black));
    const legal = legalPliesFor(play.board, play.sideToMove);

    const asyncEvaluate: PositionEvaluator = async () => {
      await Promise.resolve();
      return { value: 0, policy: pseudoRandomPolicy(2) };
    };

    const chosen = await chooseEnginePly(play, asyncEvaluate, seededRandom(2));
    expect(containsPly(legal, chosen)).toBe(true);
  });

  it("is deterministic and reproducible with a fixed seed and a fixed fake policy", async () => {
    const white = autoFill(
      emptyPlacement("white"),
      seededRandomForPlacement(21),
    );
    const black = autoFill(
      emptyPlacement("black"),
      seededRandomForPlacement(23),
    );
    const play = startPlay(buildInitialGameState(white, black));
    const policy = pseudoRandomPolicy(42);

    const first = await chooseEnginePly(
      play,
      fixedPolicyEvaluator(policy),
      seededRandom(42),
    );
    const second = await chooseEnginePly(
      play,
      fixedPolicyEvaluator(policy),
      seededRandom(42),
    );

    expect(first).toEqual(second);
  });

  it("over many autoFill-generated mid-game positions, both sides to move, and many seeds, always resolves to a legal, on-board ply", async () => {
    const positions = midGamePositions();
    expect(positions.length).toBeGreaterThan(0);

    const sidesSeen = new Set<Side>();
    let scenarioCount = 0;

    for (const play of positions) {
      sidesSeen.add(play.sideToMove);
      const legal = legalPliesFor(play.board, play.sideToMove);

      for (const seed of [1, 2, 3, 4, 5]) {
        const evaluate = fixedPolicyEvaluator(
          pseudoRandomPolicy(seed * 13 + 3),
        );
        const chosen = await chooseEnginePly(
          play,
          evaluate,
          seededRandom(seed * 97 + (play.sideToMove === "white" ? 0 : 1)),
        );

        expect(isOnBoard(chosen.from)).toBe(true);
        expect(isOnBoard(chosen.to)).toBe(true);
        expect(containsPly(legal, chosen)).toBe(true);
        scenarioCount += 1;
      }
    }

    // Confirms the position spread actually exercises both sides to move.
    expect(sidesSeen.has("white")).toBe(true);
    expect(sidesSeen.has("black")).toBe(true);
    expect(scenarioCount).toBeGreaterThan(0);
  });
});
