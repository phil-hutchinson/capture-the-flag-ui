import { describe, expect, it } from "vitest";
import {
  BLACK_HOME_ROWS,
  COLUMN_COUNT,
  COLUMNS,
  halfOfColumn,
  ROWS,
  WHITE_HOME_ROWS,
  type Row,
  type Square,
} from "./board.ts";
import {
  FLAG_QUANTITY_PER_SIDE,
  NUMBERED_PIECE_COUNT_PER_SIDE,
  RANK_CATALOG,
  RANKS,
} from "./pieces.ts";
import {
  EMPTY_POSITION,
  findFlag,
  pieceAt,
  placePiece,
  type PositionState,
} from "./position.ts";
import {
  deriveBlackArrangement,
  generateStartPosition,
  generateWhiteArrangement,
  type RandomSource,
} from "./startPosition.ts";

/**
 * A tiny deterministic PRNG (mulberry32, public domain), used only so these
 * tests can drive generation reproducibly without pulling in a dependency
 * (this story's implementation plan, Decision 7 - "a small seeded generator
 * declared in the test file"). Never used outside tests.
 */
function seededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPEN_ROWS: readonly Row[] = ROWS.filter(
  (row) => !WHITE_HOME_ROWS.includes(row) && !BLACK_HOME_ROWS.includes(row),
);

describe("startPosition (ruleset major 3): generation and the strength rule", () => {
  describe("shape", () => {
    const random = seededRandom(1);
    const samples = Array.from({ length: 200 }, () =>
      generateStartPosition(random),
    );

    it("always fills both home areas completely and leaves rows 3-6 empty", () => {
      for (const { position } of samples) {
        for (const row of WHITE_HOME_ROWS) {
          for (const column of COLUMNS) {
            expect(pieceAt(position, { column, row })).toBeDefined();
          }
        }
        for (const row of BLACK_HOME_ROWS) {
          for (const column of COLUMNS) {
            expect(pieceAt(position, { column, row })).toBeDefined();
          }
        }
        for (const row of OPEN_ROWS) {
          for (const column of COLUMNS) {
            expect(pieceAt(position, { column, row })).toBeUndefined();
          }
        }
      }
    });

    it("gives each side exactly three of each rank and one Flag", () => {
      for (const { position } of samples) {
        for (const side of ["white", "black"] as const) {
          const rows = side === "white" ? WHITE_HOME_ROWS : BLACK_HOME_ROWS;
          const counts: Record<string, number> = {};
          for (const row of rows) {
            for (const column of COLUMNS) {
              const piece = pieceAt(position, { column, row });
              expect(piece?.side).toBe(side);
              const key =
                piece?.kind === "flag"
                  ? "flag"
                  : `rank${piece?.kind === "numbered" ? piece.rank : ""}`;
              counts[key] = (counts[key] ?? 0) + 1;
            }
          }
          expect(counts.flag).toBe(FLAG_QUANTITY_PER_SIDE);
          for (const rank of RANKS) {
            expect(counts[`rank${rank}`]).toBe(
              RANK_CATALOG[rank].quantityPerSide,
            );
          }
        }
      }
    });

    it("always places White's Flag on row 1", () => {
      for (const { position } of samples) {
        const flagSquare = findFlag(position, "white");
        expect(flagSquare?.row).toBe(WHITE_HOME_ROWS[0]);
      }
    });

    it("leaves White's row 2 completely full of numbered pieces (the 8 opening squares)", () => {
      for (const { position } of samples) {
        const row2Count = COLUMNS.filter((column) => {
          const piece = pieceAt(position, { column, row: WHITE_HOME_ROWS[1] });
          return piece?.kind === "numbered";
        }).length;
        expect(row2Count).toBe(8);
      }
    });
  });

  describe("uniformity", () => {
    const random = seededRandom(2);
    const samples = Array.from({ length: 4000 }, () =>
      generateWhiteArrangement(random),
    );

    it("places the Flag on every one of row 1's 8 columns over a large sample", () => {
      const columnsSeen = new Set<string>();
      for (const position of samples) {
        const flagSquare = findFlag(position, "white");
        if (flagSquare !== undefined) {
          columnsSeen.add(flagSquare.column);
        }
      }
      expect(columnsSeen.size).toBe(COLUMN_COUNT);
    });

    it("places every rank on every one of the 16 White squares at least once", () => {
      const seenByRank: Record<number, Set<string>> = {
        1: new Set(),
        2: new Set(),
        3: new Set(),
        4: new Set(),
        5: new Set(),
      };
      for (const position of samples) {
        for (const row of WHITE_HOME_ROWS) {
          for (const column of COLUMNS) {
            const piece = pieceAt(position, { column, row });
            if (piece?.kind === "numbered") {
              seenByRank[piece.rank].add(`${column}${row}`);
            }
          }
        }
      }
      for (const rank of RANKS) {
        // 16 squares total, minus the one occupied by the Flag on that draw -
        // every square must appear as a candidate across a large enough
        // sample, so each rank should be seen on all 16 (the Flag moves
        // between draws, so no square is permanently excluded from any rank).
        expect(seenByRank[rank].size).toBe(16);
      }
    });
  });

  describe("the strength rule", () => {
    // A hand-built White arrangement whose Flag-half sum S is exactly 21 (the
    // reflection boundary): flag on D1, the rest of the left half (A1, B1,
    // C1, A2, B2, C2, D2) holding three 5s, three 1s and one 3
    // (5+5+5+1+1+1+3 = 21), and the right half holding the rest.
    function buildBoundaryArrangement(seventhLeftRank: 3 | 4): PositionState {
      const leftHalfSquares: Square[] = [
        { column: "A", row: 1 },
        { column: "B", row: 1 },
        { column: "C", row: 1 },
        { column: "A", row: 2 },
        { column: "B", row: 2 },
        { column: "C", row: 2 },
        { column: "D", row: 2 },
      ];
      const leftRanks = [5, 5, 5, 1, 1, 1, seventhLeftRank] as const;

      const rightHalfSquares: Square[] = [
        { column: "E", row: 1 },
        { column: "F", row: 1 },
        { column: "G", row: 1 },
        { column: "H", row: 1 },
        { column: "E", row: 2 },
        { column: "F", row: 2 },
        { column: "G", row: 2 },
        { column: "H", row: 2 },
      ];
      // Whatever is left of the 15-piece multiset once the left half above is
      // removed: three 4s, two 3s, three 2s when seventhLeftRank is 3; two
      // 4s, three 3s, three 2s when it is 4.
      const rightRanks =
        seventhLeftRank === 3
          ? ([4, 4, 4, 3, 3, 2, 2, 2] as const)
          : ([4, 4, 3, 3, 3, 2, 2, 2] as const);

      let position: PositionState = placePiece(
        EMPTY_POSITION,
        { column: "D", row: 1 },
        {
          side: "white",
          kind: "flag",
        },
      );
      leftHalfSquares.forEach((square, index) => {
        position = placePiece(position, square, {
          side: "white",
          kind: "numbered",
          rank: leftRanks[index],
        });
      });
      rightHalfSquares.forEach((square, index) => {
        position = placePiece(position, square, {
          side: "white",
          kind: "numbered",
          rank: rightRanks[index],
        });
      });
      return position;
    }

    it("S = 21 takes the reflection branch", () => {
      const white = buildBoundaryArrangement(3);
      const { turn } = deriveBlackArrangement(white);
      expect(turn).toBe("reflection");
    });

    it("S = 22 takes the half-turn branch", () => {
      const white = buildBoundaryArrangement(4);
      const { turn } = deriveBlackArrangement(white);
      expect(turn).toBe("halfTurn");
    });

    it("reflection maps every square (column unchanged, row -> 9 - row) and leaves the Flags in the same column", () => {
      const white = buildBoundaryArrangement(3);
      const { position: black, turn } = deriveBlackArrangement(white);
      expect(turn).toBe("reflection");

      for (const row of WHITE_HOME_ROWS) {
        for (const column of COLUMNS) {
          const whitePiece = pieceAt(white, { column, row });
          const blackPiece = pieceAt(black, { column, row: 9 - row });
          if (whitePiece === undefined) {
            expect(blackPiece).toBeUndefined();
          } else if (whitePiece.kind === "flag") {
            expect(blackPiece).toEqual({ side: "black", kind: "flag" });
          } else {
            expect(blackPiece).toEqual({
              side: "black",
              kind: "numbered",
              rank: whitePiece.rank,
            });
          }
        }
      }

      const whiteFlag = findFlag(white, "white")!;
      const blackFlag = findFlag(black, "black")!;
      expect(blackFlag.column).toBe(whiteFlag.column);
    });

    it("half-turn maps every square (column -> 9 - column, row -> 9 - row) and puts the Flags in opposite halves", () => {
      const white = buildBoundaryArrangement(4);
      const { position: black, turn } = deriveBlackArrangement(white);
      expect(turn).toBe("halfTurn");

      for (const row of WHITE_HOME_ROWS) {
        for (const column of COLUMNS) {
          const whitePiece = pieceAt(white, { column, row });
          const turnedColumn =
            COLUMNS[COLUMN_COUNT - 1 - COLUMNS.indexOf(column)];
          const blackPiece = pieceAt(black, {
            column: turnedColumn,
            row: 9 - row,
          });
          if (whitePiece === undefined) {
            expect(blackPiece).toBeUndefined();
          } else if (whitePiece.kind === "flag") {
            expect(blackPiece).toEqual({ side: "black", kind: "flag" });
          } else {
            expect(blackPiece).toEqual({
              side: "black",
              kind: "numbered",
              rank: whitePiece.rank,
            });
          }
        }
      }

      const whiteFlag = findFlag(white, "white")!;
      const blackFlag = findFlag(black, "black")!;
      expect(halfOfColumn(blackFlag.column)).not.toBe(
        halfOfColumn(whiteFlag.column),
      );
    });

    it("both branches occur over a sample of generated positions", () => {
      const random = seededRandom(3);
      const turnsSeen = new Set<string>();
      for (let index = 0; index < 300; index += 1) {
        turnsSeen.add(generateStartPosition(random).turn);
      }
      expect(turnsSeen).toEqual(new Set(["reflection", "halfTurn"]));
    });

    it("the derived threshold equals 21, recomputed from the army data alone", () => {
      // An independent recomputation (not the module's own internal
      // constants) of start-position.md §3's derivation: if this ever
      // disagrees with 21, the army composition changed and the threshold
      // must be re-derived, not carried forward - exactly the failure this
      // test exists to catch.
      const totalRank = RANKS.reduce(
        (sum, rank) => sum + rank * RANK_CATALOG[rank].quantityPerSide,
        0,
      );
      const halfSquareCount = (COLUMN_COUNT / 2) * WHITE_HOME_ROWS.length;
      const piecesInFlagHalf = halfSquareCount - FLAG_QUANTITY_PER_SIDE;
      const threshold = Math.floor(
        (piecesInFlagHalf * totalRank) / NUMBERED_PIECE_COUNT_PER_SIDE,
      );
      expect(threshold).toBe(21);
    });
  });

  describe("openings", () => {
    it("White always has exactly 8 pieces on row 2 - one per front-row opening move (movement itself is Step 5's concern)", () => {
      const random = seededRandom(4);
      for (let index = 0; index < 50; index += 1) {
        const { position } = generateStartPosition(random);
        const row2Count = COLUMNS.filter((column) => {
          const piece = pieceAt(position, { column, row: WHITE_HOME_ROWS[1] });
          return piece?.kind === "numbered";
        }).length;
        expect(row2Count).toBe(8);
      }
    });
  });

  describe("the position ID", () => {
    it("is encoded from White's arrangement, and round-trips through the generator's own output", () => {
      const random = seededRandom(5);
      const { position, positionId } = generateStartPosition(random);
      expect(positionId).toHaveLength(16);
      const flagSquare = findFlag(position, "white")!;
      expect(positionId[COLUMNS.indexOf(flagSquare.column)]).toBe("F");
    });
  });
});
