import { describe, expect, it } from "vitest";
import {
  allSquares,
  squareKey,
  type Side,
  type Square,
} from "../../rules/primary/v1/board.ts";
import { buildInitialGameState } from "../../rules/primary/v1/gameState.ts";
import type {
  BoardState,
  PlacedPiece,
} from "../../rules/primary/v1/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../../rules/primary/v1/movement.ts";
import {
  autoFill,
  emptyPlacement,
  type RandomSource as PlacementRandomSource,
} from "../../rules/primary/v1/placement.ts";
import type { PieceTypeId } from "../../rules/primary/v1/pieces.ts";
import {
  MOVEMENT_OFFSETS,
  POLICY_LENGTH,
  policyIndexForPly,
  selectEnginePly,
  type Ply,
  type RandomSource,
} from "./decoder.ts";
import { flatIndex } from "./shared.ts";

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
 * A tiny seeded linear-congruential generator, used only so tests can assert
 * reproducibility with a fixed seed without depending on `Math.random`.
 * Matches the pattern used in `src/rules/primary/v1/placement.test.ts`.
 */
function seededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** White's tensor coordinates, computed independently of `shared.ts` for a from-scratch check. */
function whiteTensor(square: Square): { row: number; col: number } {
  return { row: square.row - 1, col: "ABCDEFGHIJKL".indexOf(square.column) };
}

/** Black's tensor coordinates, computed independently of `shared.ts` for a from-scratch check. */
function blackTensor(square: Square): { row: number; col: number } {
  return {
    row: 12 - square.row,
    col: 11 - "ABCDEFGHIJKL".indexOf(square.column),
  };
}

/** Every legal ply for `side` on `boardState`, recomputed directly from the rules engine's own API. */
function legalPliesFor(boardState: BoardState, side: Side): Ply[] {
  const plies: Ply[] = [];
  for (const origin of allSquares()) {
    const occupant = boardState[squareKey(origin)];
    if (occupant === undefined || occupant.side !== side) {
      continue;
    }
    for (const to of legalDestinations(boardState, origin)) {
      plies.push({ from: origin, to });
    }
    for (const to of legalAttacks(boardState, origin)) {
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

describe("MOVEMENT_OFFSETS", () => {
  it("matches the ENG_NN_1 spec table exactly", () => {
    expect(MOVEMENT_OFFSETS).toEqual([
      { dRow: 1, dCol: 0 }, // up one
      { dRow: 0, dCol: 1 }, // right one
      { dRow: -1, dCol: 0 }, // down one
      { dRow: 0, dCol: -1 }, // left one
      { dRow: 2, dCol: 0 }, // up two
      { dRow: 0, dCol: 2 }, // right two
      { dRow: -2, dCol: 0 }, // down two
      { dRow: 0, dCol: -2 }, // left two
    ]);
  });
});

describe("policyIndexForPly", () => {
  const from: Square = { column: "E", row: 5 };

  const WHITE_CASES: readonly [string, Square, number][] = [
    ["up one", { column: "E", row: 6 }, 0],
    ["right one", { column: "F", row: 5 }, 1],
    ["down one", { column: "E", row: 4 }, 2],
    ["left one", { column: "D", row: 5 }, 3],
    ["up two", { column: "E", row: 7 }, 4],
    ["right two", { column: "G", row: 5 }, 5],
    ["down two", { column: "E", row: 3 }, 6],
    ["left two", { column: "C", row: 5 }, 7],
  ];

  // Black's frame is White's rotated 180 degrees, so the *board* direction
  // that lands on each movement index flips sign relative to White's.
  const BLACK_CASES: readonly [string, Square, number][] = [
    ["up one", { column: "E", row: 4 }, 0],
    ["right one", { column: "D", row: 5 }, 1],
    ["down one", { column: "E", row: 6 }, 2],
    ["left one", { column: "F", row: 5 }, 3],
    ["up two", { column: "E", row: 3 }, 4],
    ["right two", { column: "C", row: 5 }, 5],
    ["down two", { column: "E", row: 7 }, 6],
    ["left two", { column: "G", row: 5 }, 7],
  ];

  for (const [label, to, movementIndex] of WHITE_CASES) {
    it(`White, ${label}: maps to movement index ${movementIndex} at the source's tensor cell`, () => {
      const { row, col } = whiteTensor(from);
      const expected = flatIndex(movementIndex, row, col);
      const actual = policyIndexForPly({ from, to }, "white");
      expect(actual).toBe(expected);
      expect(actual).toBeGreaterThanOrEqual(0);
      expect(actual).toBeLessThan(POLICY_LENGTH);
    });
  }

  for (const [label, to, movementIndex] of BLACK_CASES) {
    it(`Black, ${label}: maps to movement index ${movementIndex} at the source's tensor cell (180-degree sign flip)`, () => {
      const { row, col } = blackTensor(from);
      const expected = flatIndex(movementIndex, row, col);
      const actual = policyIndexForPly({ from, to }, "black");
      expect(actual).toBe(expected);
      expect(actual).toBeGreaterThanOrEqual(0);
      expect(actual).toBeLessThan(POLICY_LENGTH);
    });
  }

  it("maps every legal ply from a real position to a distinct, in-range flat index", () => {
    // Militia at E5 (unencumbered) with an enemy two squares away at E7:
    // exercises all 8 offsets at once (7 destinations + 1 attack).
    const militiaBoard = board([
      ["E5", "white", "militia"],
      ["E7", "black", "militia"],
    ]);
    const plies = legalPliesFor(militiaBoard, "white");
    expect(plies).toHaveLength(8);

    const indices = plies.map((ply) => policyIndexForPly(ply, "white"));
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(POLICY_LENGTH);
    }
    expect(new Set(indices).size).toBe(indices.length);
  });
});

describe("selectEnginePly - masking and sampling", () => {
  it("always selects the one legal ply the policy puts all its mass on, for any random draw", () => {
    const militiaBoard = board([
      ["E5", "white", "militia"],
      ["E7", "black", "militia"],
    ]);
    const targetPly: Ply = {
      from: { column: "E", row: 5 },
      to: { column: "E", row: 7 },
    };
    const policy = new Float32Array(POLICY_LENGTH);
    policy[policyIndexForPly(targetPly, "white")] = 1000;

    for (const sample of [0, 0.1, 0.5, 0.9, 0.999999]) {
      const chosen = selectEnginePly(
        policy,
        militiaBoard,
        "white",
        () => sample,
      );
      expect(chosen).toEqual(targetPly);
    }
  });

  it("never selects a ply that isn't the one carrying all the mass, even at the edge of [0, 1)", () => {
    const militiaBoard = board([
      ["E5", "white", "militia"],
      ["F5", "white", "footSoldier"],
    ]);
    const targetPly: Ply = {
      from: { column: "E", row: 5 },
      to: { column: "E", row: 4 },
    };
    const policy = new Float32Array(POLICY_LENGTH);
    policy[policyIndexForPly(targetPly, "white")] = 1000;

    const chosen = selectEnginePly(
      policy,
      militiaBoard,
      "white",
      () => 0.9999999999,
    );
    expect(chosen).toEqual(targetPly);
  });

  it("is deterministic and reproducible with a fixed seed", () => {
    const militiaBoard = board([
      ["E5", "white", "militia"],
      ["E7", "black", "militia"],
      ["G5", "black", "footSoldier"],
    ]);
    const policy = new Float32Array(POLICY_LENGTH);
    for (let i = 0; i < POLICY_LENGTH; i += 1) {
      policy[i] = Math.sin(i * 0.37) * 5;
    }

    const first = selectEnginePly(
      policy,
      militiaBoard,
      "white",
      seededRandom(42),
    );
    const second = selectEnginePly(
      policy,
      militiaBoard,
      "white",
      seededRandom(42),
    );
    expect(first).toEqual(second);
  });

  it("throws when the side to move has no legal ply", () => {
    const emptyBoard: BoardState = {};
    const policy = new Float32Array(POLICY_LENGTH);
    expect(() => selectEnginePly(policy, emptyBoard, "white")).toThrow();
  });

  it("over a spread of positions, sides, and seeds, always selects a ply the rules engine reports as legal", () => {
    const positions: BoardState[] = [];

    // A handful of full autoFill-generated initial armies (a "spread" of
    // starting positions, per the seeded-army pattern in placement.test.ts).
    const placementSeeds: readonly PlacementRandomSource[] = [
      seededRandomForPlacement(1),
      seededRandomForPlacement(17),
      seededRandomForPlacement(203),
    ];
    for (const random of placementSeeds) {
      const white = autoFill(emptyPlacement("white"), random);
      const black = autoFill(emptyPlacement("black"), random);
      positions.push(buildInitialGameState(white, black).board);
    }

    // A hand-built, denser mid-game-like position near the lake, with mixed
    // moves and attacks available to both sides.
    positions.push(
      board([
        ["E5", "white", "militia"],
        ["F5", "white", "footSoldier"],
        ["D5", "white", "knight"],
        ["E7", "black", "militia"],
        ["G5", "black", "halberdier"],
        ["D8", "black", "champion"],
      ]),
    );

    let scenarioCount = 0;
    for (const boardState of positions) {
      for (const side of ["white", "black"] as const) {
        const legal = legalPliesFor(boardState, side);
        if (legal.length === 0) {
          continue;
        }
        for (const seed of [1, 2, 3, 4, 5]) {
          const random = seededRandom(seed * 97 + (side === "white" ? 0 : 1));
          const policy = new Float32Array(POLICY_LENGTH);
          const policySeed = seededRandom(seed * 13 + 3);
          for (let i = 0; i < POLICY_LENGTH; i += 1) {
            policy[i] = policySeed() * 20 - 10;
          }

          const chosen = selectEnginePly(policy, boardState, side, random);
          expect(containsPly(legal, chosen)).toBe(true);
          scenarioCount += 1;
        }
      }
    }
    expect(scenarioCount).toBeGreaterThan(0);
  });
});

/** A seeded `RandomSource` compatible with `autoFill`'s own type (same LCG as `seededRandom`). */
function seededRandomForPlacement(seed: number): PlacementRandomSource {
  return seededRandom(seed);
}
