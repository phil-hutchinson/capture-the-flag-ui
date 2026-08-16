import { describe, expect, it } from "vitest";
import { allSquares } from "../rules/primary/v3/board.ts";
import { RANK_CATALOG } from "../rules/primary/v3/pieces.ts";
import { generateStartPosition } from "../rules/primary/v3/startPosition.ts";
import type { PositionState } from "../rules/primary/v3/position.ts";
import { pieceArtForRankOrFlag } from "./pieceArtByRank.ts";
import {
  boardGeometryForDemotion,
  boardPositionForDemotion,
} from "./boardViewAdapterV3.ts";

describe("boardGeometryForDemotion", () => {
  it("is a fixed 8x8 board", () => {
    const geometry = boardGeometryForDemotion();
    expect(geometry.columnCount).toBe(8);
    expect(geometry.rowCount).toBe(8);
  });

  it("has no impassable squares at all - major 3 has no terrain of any kind", () => {
    const geometry = boardGeometryForDemotion();
    expect(geometry.impassableSquares.size).toBe(0);
    for (const square of allSquares()) {
      expect(
        geometry.impassableSquares.has(`${square.column}${square.row}`),
      ).toBe(false);
    }
  });
});

describe("boardPositionForDemotion", () => {
  it("turns an empty board into an empty position", () => {
    const board: PositionState = {};
    expect(boardPositionForDemotion(board)).toEqual({ tokens: {} });
  });

  it("carries each occupied square's side, art (by rank), and an occupant label naming the piece's current rank", () => {
    const board: PositionState = {
      A1: { side: "white", kind: "flag" },
      B1: { side: "white", kind: "numbered", rank: 5 },
      H8: { side: "black", kind: "numbered", rank: 1 },
    };
    const position = boardPositionForDemotion(board);
    expect(position.tokens.A1).toEqual({
      side: "white",
      art: pieceArtForRankOrFlag("flag"),
      label: "Flag",
    });
    expect(position.tokens.B1).toEqual({
      side: "white",
      art: pieceArtForRankOrFlag(5),
      label: "Master-of-Arms, rank 5",
    });
    expect(position.tokens.H8).toEqual({
      side: "black",
      art: pieceArtForRankOrFlag(1),
      label: "Peasant, rank 1",
    });
    expect(Object.keys(position.tokens)).toHaveLength(3);
  });

  it("a demoted piece's label reflects its new rank, not its original one", () => {
    const board: PositionState = {
      C3: { side: "black", kind: "numbered", rank: 4 },
    };
    const position = boardPositionForDemotion(board);
    expect(position.tokens.C3.label).toBe("Champion, rank 4");
    expect(position.tokens.C3.art).toEqual(pieceArtForRankOrFlag(4));
  });

  it("covers exactly 32 squares for a freshly generated starting position, matching art and label to every piece", () => {
    const { position: board } = generateStartPosition(() => 0.5);
    const position = boardPositionForDemotion(board);
    expect(Object.keys(position.tokens)).toHaveLength(32);
    for (const [key, piece] of Object.entries(board)) {
      const token = position.tokens[key];
      expect(token.side).toBe(piece.side);
      if (piece.kind === "flag") {
        expect(token.label).toBe("Flag");
        expect(token.art).toEqual(pieceArtForRankOrFlag("flag"));
      } else {
        expect(token.label).toBe(
          `${RANK_CATALOG[piece.rank].displayName}, rank ${piece.rank}`,
        );
        expect(token.art).toEqual(pieceArtForRankOrFlag(piece.rank));
      }
    }
  });
});
