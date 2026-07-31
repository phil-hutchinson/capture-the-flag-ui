import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  allSquares,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v2/board.ts";
import { buildInitialGameState } from "../rules/primary/v2/gameState.ts";
import type { BoardState, PlacedPiece } from "../rules/primary/v2/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v2/movement.ts";
import {
  autoFill,
  emptyPlacement,
  type RandomSource as PlacementRandomSource,
} from "../rules/primary/v2/placement.ts";
import type { PieceTypeId } from "../rules/primary/v2/pieces.ts";
import {
  applyMove,
  startPlay,
  type PlayState,
} from "../rules/primary/v2/play.ts";
import { computeOutcome } from "../rules/primary/v2/outcome.ts";
import {
  POLICY_LENGTH,
  policyIndexForPly,
  type Ply,
  type RandomSource,
} from "../encoding/eng-nn-1/decoder.ts";
import {
  createSearchNode,
  mostVisitedPly,
  runSearch,
  DEFAULT_SEARCH_CONFIG,
  type PositionEvaluator,
  type SearchNode,
} from "./search.ts";

/**
 * A tiny seeded linear-congruential generator, used only so tests can assert
 * reproducibility with a fixed seed without depending on `Math.random`.
 * Matches the pattern used in `src/rules/primary/v2/placement.test.ts` and
 * `src/engine/enginePlayer.test.ts`.
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
function legalPliesFor(board: BoardState, side: Side): Ply[] {
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
 * Recursively confirms every edge anywhere in `node`'s explored tree is a
 * legal, on-board ply for its own node's position - the standing invariant
 * the search rests on: it never invents a move, only ever expands the rules
 * engine's own legal set (`enumerateLegalPlies`, exercised here independently
 * via `legalPliesFor`).
 */
function assertTreeOnlyHoldsLegalPlies(node: SearchNode): void {
  if (node.edges === undefined) {
    return;
  }
  const legal = legalPliesFor(node.state.board, node.state.sideToMove);
  for (const edge of node.edges) {
    expect(containsPly(legal, edge.ply)).toBe(true);
    expect(isOnBoard(edge.ply.from)).toBe(true);
    expect(isOnBoard(edge.ply.to)).toBe(true);
    if (edge.child !== undefined) {
      assertTreeOnlyHoldsLegalPlies(edge.child);
    }
  }
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

/** A hand-built `PlayState` for a board built only for this test (not a full army) - `computeOutcome` drives `result` exactly as `startPlay`/`applyMove` would. */
function buildPlayState(
  boardState: BoardState,
  sideToMove: Side,
  inactivityCounter = 0,
): PlayState {
  return {
    ruleset: "test-ruleset",
    initialBoard: boardState,
    board: boardState,
    sideToMove,
    moves: [],
    inactivityCounter,
    result: computeOutcome(boardState, sideToMove, inactivityCounter),
  };
}

/** A fake `PositionEvaluator` returning a fixed value and a fixed, hand-built policy - no inference, no WASM. */
function fixedEvaluator(
  value: number,
  policy: Float32Array,
): PositionEvaluator {
  return () => ({ value, policy });
}

/** A flat evaluator: value always 0, and a uniform (all-zero-logit) policy - the "zero-weight reference model" this story ships. */
function flatEvaluator(): PositionEvaluator {
  return fixedEvaluator(0, new Float32Array(POLICY_LENGTH));
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

/** A hand-built policy with all its mass on `ply`'s flat index (from `mover`'s frame). */
function allMassOn(ply: Ply, mover: Side): Float32Array {
  const policy = new Float32Array(POLICY_LENGTH);
  policy[policyIndexForPly(ply, mover)] = 1000;
  return policy;
}

/** A handful of ongoing mid-game `PlayState`s, built from seeded `autoFill` armies and a few random plies (same pattern as `enginePlayer.test.ts`'s `midGamePositions`). */
function midGamePositions(): PlayState[] {
  const positions: PlayState[] = [];
  const placementSeeds = [1, 17, 203];
  const plyCounts = [0, 4, 9];

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
      let state = play;
      const random = seededRandom(seed * 997 + plyCount);
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
      if (
        state.result.kind === "ongoing" &&
        legalPliesFor(state.board, state.sideToMove).length > 0
      ) {
        positions.push(state);
      }
    }
  }

  return positions;
}

describe("runSearch / mostVisitedPly", () => {
  it("(a) over many autoFill-generated mid-game positions, both sides to move, the whole explored tree and the chosen ply are always legal and on-board", async () => {
    const positions = midGamePositions();
    expect(positions.length).toBeGreaterThan(0);

    const sidesSeen = new Set<Side>();
    let scenarioCount = 0;

    for (const play of positions) {
      sidesSeen.add(play.sideToMove);
      const legal = legalPliesFor(play.board, play.sideToMove);

      for (const seed of [1, 2, 3]) {
        const evaluate = fixedEvaluator(0, pseudoRandomPolicy(seed * 13 + 3));
        const root = createSearchNode(play);
        await runSearch(
          root,
          30,
          evaluate,
          DEFAULT_SEARCH_CONFIG,
          seededRandom(seed * 97 + (play.sideToMove === "white" ? 0 : 1)),
        );

        assertTreeOnlyHoldsLegalPlies(root);

        const chosen = mostVisitedPly(root, seededRandom(seed));
        expect(isOnBoard(chosen.from)).toBe(true);
        expect(isOnBoard(chosen.to)).toBe(true);
        expect(containsPly(legal, chosen)).toBe(true);
        scenarioCount += 1;
      }
    }

    expect(sidesSeen.has("white")).toBe(true);
    expect(sidesSeen.has("black")).toBe(true);
    expect(scenarioCount).toBeGreaterThan(0);
  });

  it("(b) finds a forced flag-capture win within a small budget under a flat (all-zero) evaluator, and the mirror terminal position back-propagates -1", async () => {
    // White militia at E5 can attack Black's Flag at E6 outright (attacking a
    // Flag always wins - combat.ts) but also has three plain destinations
    // (D5, F5, E4); a decoy White Foot Soldier at H5 (far from any enemy, so
    // unencumbered) has eight further destinations of its own. A lone Black
    // Militia at L10 is present only so this isn't a degenerate one-piece
    // army; it plays no part in the tactic. Both sides need their own Flag
    // present too (`computeOutcome`'s flag-capture check looks at both, and a
    // hand-built board - unlike a real army - has no other guarantee one
    // exists) - White's, at A1, is far from everything above and never comes
    // into play.
    const winningBoard = board([
      ["E5", "white", "militia"],
      ["H5", "white", "footSoldier"],
      ["A1", "white", "flag"],
      ["E6", "black", "flag"],
      ["L10", "black", "militia"],
    ]);
    const root = buildPlayState(winningBoard, "white");
    expect(root.result.kind).toBe("ongoing");

    const winningPly: Ply = {
      from: { column: "E", row: 5 },
      to: { column: "E", row: 6 },
    };
    const legal = legalPliesFor(winningBoard, "white");
    expect(containsPly(legal, winningPly)).toBe(true);
    expect(legal.length).toBeGreaterThan(1); // more than one real choice at root

    const searchRoot = createSearchNode(root);
    await runSearch(
      searchRoot,
      200,
      flatEvaluator(),
      DEFAULT_SEARCH_CONFIG,
      seededRandom(7),
    );

    const chosen = mostVisitedPly(searchRoot, seededRandom(7));
    expect(chosen).toEqual(winningPly);

    // The mirror: the position immediately *after* that winning capture,
    // examined as its own root from the losing side's perspective. It is
    // already a finished game (Black has no Flag, Black to move) - a forced
    // loss for the side to move, worth exactly -1 by `terminalValue`'s
    // convention. Running the search on an already-terminal root just
    // re-derives and re-backs-up that same fixed value every iteration.
    const { state: afterCapture } = applyMove(
      root,
      winningPly.from,
      winningPly.to,
    );
    expect(afterCapture.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
    expect(afterCapture.sideToMove).toBe("black");

    const mirrorRoot = createSearchNode(afterCapture);
    const iterations = 5;
    await runSearch(
      mirrorRoot,
      iterations,
      flatEvaluator(),
      DEFAULT_SEARCH_CONFIG,
      seededRandom(3),
    );

    expect(mirrorRoot.visitCount).toBe(iterations);
    expect(mirrorRoot.totalValue).toBe(-iterations);
  });

  it("(c) is deterministic and reproducible given a fixed evaluator and a fixed random source, with ties broken by the injected random source", async () => {
    const white = autoFill(
      emptyPlacement("white"),
      seededRandomForPlacement(21),
    );
    const black = autoFill(
      emptyPlacement("black"),
      seededRandomForPlacement(23),
    );
    const play = startPlay(buildInitialGameState(white, black));
    const evaluate = fixedEvaluator(0, pseudoRandomPolicy(42));

    const firstRoot = createSearchNode(play);
    await runSearch(
      firstRoot,
      40,
      evaluate,
      DEFAULT_SEARCH_CONFIG,
      seededRandom(42),
    );
    const firstChosen = mostVisitedPly(firstRoot, seededRandom(1));

    const secondRoot = createSearchNode(play);
    await runSearch(
      secondRoot,
      40,
      evaluate,
      DEFAULT_SEARCH_CONFIG,
      seededRandom(42),
    );
    const secondChosen = mostVisitedPly(secondRoot, seededRandom(1));

    expect(firstChosen).toEqual(secondChosen);
    expect(firstRoot.visitCount).toBe(secondRoot.visitCount);
    expect(firstRoot.totalValue).toBe(secondRoot.totalValue);

    // Tie-breaking itself: right after root's first expansion (one
    // iteration), every child is still unvisited (tied at 0), so the choice
    // among them comes down entirely to the injected random source.
    const militiaBoard = board([
      ["E5", "white", "militia"],
      ["F5", "white", "footSoldier"],
      ["D5", "white", "knight"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const tiedPlay = buildPlayState(militiaBoard, "white");
    const tiedLegal = legalPliesFor(militiaBoard, "white");
    expect(tiedLegal.length).toBeGreaterThan(1);

    const tiedRoot = createSearchNode(tiedPlay);
    await runSearch(
      tiedRoot,
      1,
      flatEvaluator(),
      DEFAULT_SEARCH_CONFIG,
      () => 0,
    );
    const chosenAtZero = mostVisitedPly(tiedRoot, () => 0);
    const chosenNearOne = mostVisitedPly(tiedRoot, () => 0.999999);

    expect(containsPly(tiedLegal, chosenAtZero)).toBe(true);
    expect(containsPly(tiedLegal, chosenNearOne)).toBe(true);
    expect(chosenAtZero).not.toEqual(chosenNearOne);
  });

  it("(d) an all-mass-on-one-ply fake policy makes that ply dominate the root's visits", async () => {
    // Black has only its (immobile) Flag - no mobile piece at all - so
    // *every* one of White's legal replies leads to the exact same outcome
    // one ply later: Black, to move, has no legal ply, an immediate
    // `noLegalMove` win for White. That keeps every root edge's true,
    // backed-up value identical (a uniform win), so this board isolates the
    // prior's effect on visit distribution from any real tactical
    // asymmetry between White's candidate plies - unlike a board with a
    // mobile Black piece nearby, where the search can legitimately (and
    // correctly) discover that one candidate ply walks into a real
    // disadvantage deeper in the tree and de-prioritize it despite an
    // overwhelming prior, which is genuine PUCT behavior but would
    // contaminate this test's measurement.
    const militiaBoard = board([
      ["F6", "white", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const play = buildPlayState(militiaBoard, "white");
    const legal = legalPliesFor(militiaBoard, "white");
    expect(legal.length).toBeGreaterThan(1);
    const targetPly = legal[0];

    const root = createSearchNode(play);
    await runSearch(
      root,
      100,
      fixedEvaluator(0, allMassOn(targetPly, "white")),
      DEFAULT_SEARCH_CONFIG,
      seededRandom(5),
    );

    const targetEdge = root.edges?.find(
      (edge) =>
        squareKey(edge.ply.from) === squareKey(targetPly.from) &&
        squareKey(edge.ply.to) === squareKey(targetPly.to),
    );
    expect(targetEdge).toBeDefined();
    const targetVisits = targetEdge?.child?.visitCount ?? 0;

    for (const edge of root.edges ?? []) {
      if (edge === targetEdge) {
        continue;
      }
      const otherVisits = edge.child?.visitCount ?? 0;
      expect(targetVisits).toBeGreaterThan(otherVisits);
    }

    expect(mostVisitedPly(root, seededRandom(5))).toEqual(targetPly);
  });
});
