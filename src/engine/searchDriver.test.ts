import { describe, expect, it } from "vitest";
import { squareKey, type Side } from "../rules/primary/v2/board.ts";
import type { BoardState, PlacedPiece } from "../rules/primary/v2/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v2/movement.ts";
import type { PieceTypeId } from "../rules/primary/v2/pieces.ts";
import { applyMove, type PlayState } from "../rules/primary/v2/play.ts";
import { computeOutcome } from "../rules/primary/v2/outcome.ts";
import {
  POLICY_LENGTH,
  enumerateLegalPlies,
  policyIndexForPly,
  type Ply,
  type RandomSource,
} from "../encoding/eng-nn-1/decoder.ts";
import type { Position } from "../encoding/eng-nn-1/encoder.ts";
import { DEFAULT_SEARCH_CONFIG, type PositionEvaluator } from "./search.ts";
import { SearchDriver } from "./searchDriver.ts";

/**
 * A tiny seeded linear-congruential generator, matching the pattern used in
 * `search.test.ts`/`enginePlayer.test.ts`/`placement.test.ts` - deterministic
 * reproducibility without depending on `Math.random`.
 */
function seededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** Every legal ply for `side` on `board`, recomputed directly from the rules engine's own API. */
function legalPliesFor(board: BoardState, side: Side): Ply[] {
  const plies: Ply[] = [];
  for (const key of Object.keys(board)) {
    const occupant = board[key];
    if (occupant === undefined || occupant.side !== side) {
      continue;
    }
    const column = key[0] as Ply["from"]["column"];
    const row = Number(key.slice(1)) as Ply["from"]["row"];
    const origin = { column, row };
    for (const to of legalDestinations(board, origin)) {
      plies.push({ from: origin, to });
    }
    for (const to of legalAttacks(board, origin)) {
      plies.push({ from: origin, to });
    }
  }
  return plies;
}

/** True iff `a` and `b` name the same `from`/`to` squares. */
function samePly(a: Ply, b: Ply): boolean {
  return (
    squareKey(a.from) === squareKey(b.from) &&
    squareKey(a.to) === squareKey(b.to)
  );
}

/** Builds a `BoardState` from a list of `[squareKey, side, pieceType]` triples. */
function board(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): BoardState {
  const result: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    result[key] = { side, pieceType };
  }
  return result;
}

/**
 * A wide, non-interacting board: two mobile White pieces (buffer row 5) and
 * four mobile Black pieces (home rows 9-10), spaced far enough apart (movement
 * and encumbrance both cap out at two squares - `movement.ts`) that neither
 * side ever attacks or restricts the other. Both flags are present (far
 * corners, immobile) so `computeOutcome` never ends the game as the search
 * explores it - every position this board's tree reaches stays `"ongoing"`,
 * so these tests exercise retention/budget bookkeeping in isolation from
 * terminal handling (covered instead by `search.test.ts`). Wide branching at
 * both levels (White's two pieces, Black's four) makes it easy to find both
 * an explored and an unexplored reply under a modest iteration budget.
 */
function wideBoard(): BoardState {
  return board([
    ["E5", "white", "militia"],
    ["H5", "white", "footSoldier"],
    ["A1", "white", "flag"],
    ["B9", "black", "militia"],
    ["E10", "black", "footSoldier"],
    ["H9", "black", "knight"],
    ["K10", "black", "militia"],
    ["L12", "black", "flag"],
  ]);
}

/** A hand-built ongoing `PlayState` for `boardState`, `result` driven by `computeOutcome` exactly as `startPlay`/`applyMove` would. */
function buildPlayState(boardState: BoardState, sideToMove: Side): PlayState {
  return {
    ruleset: "test-ruleset",
    initialBoard: boardState,
    board: boardState,
    sideToMove,
    moves: [],
    inactivityCounter: 0,
    result: computeOutcome(boardState, sideToMove, 0),
  };
}

/** A flat evaluator: value always 0, uniform (all-zero-logit) policy - no real signal, so tree shape reflects only PUCT's exploration term. */
function flatEvaluator(): PositionEvaluator {
  return () => ({ value: 0, policy: new Float32Array(POLICY_LENGTH) });
}

/**
 * An evaluator that puts (almost) all prior mass on one specific legal ply at
 * every position it is asked to evaluate - the first ply `enumerateLegalPlies`
 * reports for that position's side to move, a deterministic choice given a
 * board. Used only to make the search concentrate heavily on a single
 * continuing line so the budget/cap arithmetic's "grows turn over turn" can
 * be observed within a small number of rounds; value is still always 0 (no
 * real tactical signal), so nothing about legality or terminal handling is
 * exercised here beyond what `search.ts`'s own tests already cover.
 */
function concentratedEvaluator(): PositionEvaluator {
  return (position: Position) => {
    const plies = enumerateLegalPlies(position.board, position.sideToMove);
    const policy = new Float32Array(POLICY_LENGTH);
    policy[policyIndexForPly(plies[0], position.sideToMove)] = 1000;
    return { value: 0, policy };
  };
}

describe("SearchDriver", () => {
  it("(a) choose -> commit a computer move, then observe an already-explored opponent reply: the retained root's visit count carries forward and only the matching child survives", async () => {
    const initial = buildPlayState(wideBoard(), "white");
    const driver = new SearchDriver(
      { search: DEFAULT_SEARCH_CONFIG, budget: 150, cap: 300 },
      flatEvaluator(),
      seededRandom(9),
    );

    expect(driver.getRetainedRoot()).toBeUndefined();
    const computerPly = await driver.choose(initial);
    // choose() never adopts the tree by itself - only commit() does.
    expect(driver.getRetainedRoot()).toBeUndefined();
    expect(driver.getPendingRoot()).toBeDefined();

    driver.commit(computerPly);
    const afterComputerMove = driver.getRetainedRoot();
    expect(afterComputerMove).toBeDefined();
    expect(afterComputerMove!.state.sideToMove).toBe("black");
    expect(afterComputerMove!.visitCount).toBeGreaterThan(0);
    expect(driver.getPendingRoot()).toBeUndefined();

    // Find a Black reply the retained tree already explored (has a built,
    // visited child) - the "predicted" case.
    const exploredEdge = (afterComputerMove!.edges ?? []).find(
      (edge) => edge.child !== undefined && edge.child.visitCount > 0,
    );
    expect(exploredEdge).toBeDefined();
    const humanPly = exploredEdge!.ply;
    const expectedChild = exploredEdge!.child!;
    const expectedVisits = expectedChild.visitCount;
    expect(expectedVisits).toBeGreaterThan(0);

    driver.observe(humanPly);
    const afterHumanReply = driver.getRetainedRoot();
    // Exactly the matching child survives - not a copy, not reset - and every
    // sibling reply is gone (the driver holds no other reference).
    expect(afterHumanReply).toBe(expectedChild);
    expect(afterHumanReply!.visitCount).toBe(expectedVisits);
    expect(afterHumanReply!.state.sideToMove).toBe("white");
  });

  it("(b) observing an opponent ply the retained tree never expanded discards the tree; the next move then runs the full budget", async () => {
    const initial = buildPlayState(wideBoard(), "white");
    const budget = 150;
    const cap = 300;
    const driver = new SearchDriver(
      { search: DEFAULT_SEARCH_CONFIG, budget, cap },
      flatEvaluator(),
      seededRandom(13),
    );

    const computerPly = await driver.choose(initial);
    driver.commit(computerPly);
    const afterComputerMove = driver.getRetainedRoot()!;
    expect(afterComputerMove.state.sideToMove).toBe("black");

    const legalReplies = legalPliesFor(afterComputerMove.state.board, "black");
    const unexploredPly = legalReplies.find((ply) => {
      const edge = (afterComputerMove.edges ?? []).find((candidate) =>
        samePly(candidate.ply, ply),
      );
      return edge === undefined || edge.child === undefined;
    });
    expect(unexploredPly).toBeDefined();

    driver.observe(unexploredPly!);
    expect(driver.getRetainedRoot()).toBeUndefined();

    const stateAfterHumanReply = applyMove(
      afterComputerMove.state,
      unexploredPly!.from,
      unexploredPly!.to,
    ).state;
    await driver.choose(stateAfterHumanReply);
    const pending = driver.getPendingRoot()!;
    // R = 0 (fresh tree) -> iterations = min(B, max(0, 2*B - 0)) = B.
    expect(pending.visitCount).toBe(budget);
  });

  it("(c) budget/cap arithmetic: a fresh root runs the full budget, and consecutive fully-predicted moves grow the root's visit count but never exceed the double cap", async () => {
    const budget = 15;
    const cap = 2 * budget;
    const driver = new SearchDriver(
      { search: DEFAULT_SEARCH_CONFIG, budget, cap },
      concentratedEvaluator(),
      seededRandom(21),
    );

    let state = buildPlayState(wideBoard(), "white");
    let reachedCap = false;

    for (let round = 0; round < 6; round += 1) {
      const before = driver.getRetainedRoot()?.visitCount ?? 0;
      const expectedIterations = Math.min(budget, Math.max(0, cap - before));

      const ply = await driver.choose(state);
      const pending = driver.getPendingRoot()!;
      expect(pending.visitCount).toBe(before + expectedIterations);
      expect(pending.visitCount).toBeGreaterThanOrEqual(Math.min(budget, cap));
      expect(pending.visitCount).toBeLessThanOrEqual(cap);
      if (pending.visitCount === cap) {
        reachedCap = true;
      }

      driver.commit(ply);
      state = driver.getRetainedRoot()!.state;
    }

    // The very first round is exactly the "fresh root runs B" case.
    expect(reachedCap).toBe(true);
  });

  it("(d) a choose() that is never committed leaves the retained root and its visit count unchanged", async () => {
    const initial = buildPlayState(wideBoard(), "white");
    const driver = new SearchDriver(
      { search: DEFAULT_SEARCH_CONFIG, budget: 40, cap: 80 },
      flatEvaluator(),
      seededRandom(31),
    );

    const firstPly = await driver.choose(initial);
    driver.commit(firstPly);
    const retainedBefore = driver.getRetainedRoot();
    expect(retainedBefore).toBeDefined();
    const visitsBefore = retainedBefore!.visitCount;

    // A superseded/cancelled turn: choose() runs (building a new pending
    // working tree) but its result is never committed.
    const supersededPly = await driver.choose(retainedBefore!.state);
    expect(driver.getPendingRoot()).toBeDefined();
    expect(driver.getRetainedRoot()).toBe(retainedBefore);
    expect(driver.getRetainedRoot()!.visitCount).toBe(visitsBefore);
    void supersededPly; // deliberately never applied or committed

    // A later reset drops both the retained tree and the stale pending one.
    driver.reset();
    expect(driver.getRetainedRoot()).toBeUndefined();
    expect(driver.getPendingRoot()).toBeUndefined();
  });
});
