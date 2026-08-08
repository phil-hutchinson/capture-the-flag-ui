import { describe, expect, it } from "vitest";
import { armySize, BATTLE_ARMY } from "./armyComposition.ts";
import { BATTLE_LAYOUT, homeSquares } from "./board.ts";
import { DERIVED_BOARD_LAYOUT_ID } from "./boardLayout.ts";
import {
  configureRules,
  STANDARD_BATTLE_CONFIGURATION,
  STANDARD_SKIRMISH_CONFIGURATION,
} from "./configuration.ts";
import { SKIRMISH_EDITION } from "./edition.ts";
import { buildGameConfiguration } from "./games.ts";
import { pieceCatalogEntries } from "./pieces.ts";
import { autoFill, emptyPlacement, type PlacementState } from "./placement.ts";

/** Battle's own army size (25) - the roster these Battle fixtures place. */
const ARMY_SIZE = armySize(BATTLE_ARMY);
import {
  buildInitialGameState,
  deriveBoardLayoutFromPositionBlock,
  parsePositionBlock,
  renderPositionBlock,
  RULESET_TAG,
  type BoardState,
  type InitialGameState,
  type PlacedPiece,
} from "./gameState.ts";

/** A tiny seeded linear-congruential generator (see placement.test.ts). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * `autoFill`, unwrapped (story 00000025's Step 8 changed its return type to
 * an `AutoFillResult` reporting exhaustion instead of throwing; every
 * fixture in this file is a fresh or lightly-seeded Battle/Skirmish board, so
 * none is expected to exhaust - see placement.test.ts's own
 * `autoFillOrThrow` for the same reasoning).
 */
function autoFillOrThrow(
  state: PlacementState,
  random: () => number,
): PlacementState {
  const result = autoFill(state, random);
  if (!result.ok) {
    throw new Error(
      "autoFillOrThrow: autoFill reported no legal arrangement, but this test expected one to exist.",
    );
  }
  return result.state;
}

function completeArmy(side: "white" | "black", seed: number): PlacementState {
  return autoFillOrThrow(
    emptyPlacement(side, BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
    seededRandom(seed),
  );
}

describe("buildInitialGameState (ruleset major 2)", () => {
  it("tags the artifact with the resolved edition's id (Battle)", () => {
    const white = completeArmy("white", 1);
    const black = completeArmy("black", 2);
    const gameState = buildInitialGameState(
      white,
      black,
      STANDARD_BATTLE_CONFIGURATION,
    );

    expect(gameState.ruleset).toBe("2-0:BATTLE");
    expect(gameState.ruleset).toBe(RULESET_TAG);
  });

  it("tags the artifact with the given edition's id (Skirmish)", () => {
    const skirmish = SKIRMISH_EDITION;
    const skirmishConfiguration = configureRules(skirmish);
    const white = autoFillOrThrow(
      emptyPlacement(
        "white",
        skirmishConfiguration.boardLayout,
        skirmishConfiguration.army,
        skirmish.towerPlacement,
      ),
      seededRandom(21),
    );
    const black = autoFillOrThrow(
      emptyPlacement(
        "black",
        skirmishConfiguration.boardLayout,
        skirmishConfiguration.army,
        skirmish.towerPlacement,
      ),
      seededRandom(22),
    );
    const gameState = buildInitialGameState(
      white,
      black,
      skirmishConfiguration,
    );

    expect(gameState.ruleset).toBe("2-1:SKIRMISH");
    expect(gameState.configuration.edition).toBe(skirmish);
  });

  it("round-trips both armies exactly through JSON", () => {
    const white = completeArmy("white", 3);
    const black = completeArmy("black", 4);
    const gameState = buildInitialGameState(
      white,
      black,
      STANDARD_BATTLE_CONFIGURATION,
    );

    const roundTripped = JSON.parse(
      JSON.stringify(gameState),
    ) as InitialGameState;
    expect(roundTripped).toEqual(gameState);

    // Every placed White/Black square in the artifact matches the source
    // placement, and vice versa - nothing was dropped, duplicated, or
    // mislabeled. A home square the source left empty (sparse placement -
    // only 25 of 48 home squares are ever filled) is absent from the board.
    for (const square of homeSquares("white")) {
      const key = `${square.column}${square.row}`;
      const placed = roundTripped.board[key];
      const expectedType = white.placements.get(key);
      if (expectedType === undefined) {
        expect(placed).toBeUndefined();
        continue;
      }
      expect(placed?.side).toBe("white");
      expect(placed?.pieceType).toBe(expectedType);
    }
    for (const square of homeSquares("black")) {
      const key = `${square.column}${square.row}`;
      const placed = roundTripped.board[key];
      const expectedType = black.placements.get(key);
      if (expectedType === undefined) {
        expect(placed).toBeUndefined();
        continue;
      }
      expect(placed?.side).toBe("black");
      expect(placed?.pieceType).toBe(expectedType);
    }

    // Each side places exactly ARMY_SIZE pieces (25 of 48 home squares).
    expect(Object.keys(roundTripped.board)).toHaveLength(2 * ARMY_SIZE);
  });

  it("rejects a White state and Black state passed in the wrong slots", () => {
    const white = completeArmy("white", 5);
    const black = completeArmy("black", 6);
    expect(() =>
      buildInitialGameState(black, white, STANDARD_BATTLE_CONFIGURATION),
    ).toThrow();
  });

  it("rejects incomplete armies", () => {
    const white = completeArmy("white", 7);
    const black = emptyPlacement(
      "black",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    expect(() =>
      buildInitialGameState(white, black, STANDARD_BATTLE_CONFIGURATION),
    ).toThrow();
  });

  it("includes every placed piece type at the ruleset's per-side quantity", () => {
    const white = completeArmy("white", 8);
    const black = completeArmy("black", 9);
    const gameState = buildInitialGameState(
      white,
      black,
      STANDARD_BATTLE_CONFIGURATION,
    );

    for (const side of ["white", "black"] as const) {
      const counts = new Map<string, number>();
      for (const placed of Object.values(gameState.board)) {
        if (placed.side !== side) continue;
        counts.set(placed.pieceType, (counts.get(placed.pieceType) ?? 0) + 1);
      }
      for (const entry of pieceCatalogEntries()) {
        expect(counts.get(entry.id)).toBe(entry.quantityPerSide);
      }
    }
  });
});

describe("renderPositionBlock (ruleset major 2)", () => {
  it("renders a hand-constructed placement to the exact expected block", () => {
    // A small, deliberately sparse board (not a full army) so the expected
    // block below can be verified by inspection square-by-square:
    //   A1  = White Flag           -> [F]
    //   L1  = White Master-of-Arms -> [1]
    //   F12 = Black Champion       -> *2*
    //   A12 = Black Tower          -> *T*
    // every other square is either empty (---) or one of the three 2x2 lakes
    // on rows 6-7 (XXX), per the `O L L O O L L O O L L O` pattern.
    const gameState: InitialGameState = {
      ruleset: RULESET_TAG,
      configuration: STANDARD_BATTLE_CONFIGURATION,
      board: {
        A1: { side: "white", pieceType: "flag" },
        L1: { side: "white", pieceType: "masterOfArms" },
        F12: { side: "black", pieceType: "champion" },
        A12: { side: "black", pieceType: "tower" },
      },
    };

    const expected = [
      "*T* --- --- --- --- *2* --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- XXX XXX --- --- XXX XXX --- --- XXX XXX ---",
      "--- XXX XXX --- --- XXX XXX --- --- XXX XXX ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "[F] --- --- --- --- --- --- --- --- --- --- [1]",
    ].join("\n");

    expect(renderPositionBlock(gameState)).toBe(expected);
  });

  it("is 12 lines of 12 three-character cells", () => {
    const white = completeArmy("white", 10);
    const black = completeArmy("black", 11);
    const gameState = buildInitialGameState(
      white,
      black,
      STANDARD_BATTLE_CONFIGURATION,
    );

    const lines = renderPositionBlock(gameState).split("\n");
    expect(lines).toHaveLength(12);
    for (const line of lines) {
      const cells = line.split(" ");
      expect(cells).toHaveLength(12);
      for (const cell of cells) {
        expect(cell).toHaveLength(3);
      }
    }
  });

  it("renders lake squares as XXX regardless of nearby placements", () => {
    const white = completeArmy("white", 12);
    const black = completeArmy("black", 13);
    const gameState = buildInitialGameState(
      white,
      black,
      STANDARD_BATTLE_CONFIGURATION,
    );
    const lines = renderPositionBlock(gameState).split("\n");

    // Rows 6 and 7 are the 6th and 7th lines from the bottom (row 1 is the
    // last line, row 12 the first): row 7 -> index 5, row 6 -> index 6.
    const row7 = lines[5].split(" ");
    const row6 = lines[6].split(" ");
    const lakeColumnIndexes = [1, 2, 5, 6, 9, 10]; // B, C, F, G, J, K
    for (const index of lakeColumnIndexes) {
      expect(row7[index]).toBe("XXX");
      expect(row6[index]).toBe("XXX");
    }
  });
});

describe("parsePositionBlock (ruleset major 2)", () => {
  /** A full-army position block, rendered from two deterministic autoFill armies. */
  function fullBoardBlock(): { board: BoardState; block: string } {
    const white = completeArmy("white", 900);
    const black = completeArmy("black", 901);
    const gameState = buildInitialGameState(
      white,
      black,
      STANDARD_BATTLE_CONFIGURATION,
    );
    return { board: gameState.board, block: renderPositionBlock(gameState) };
  }

  function parsed(result: ReturnType<typeof parsePositionBlock>): BoardState {
    expect(result.kind).toBe("parsed");
    return (result as { kind: "parsed"; board: BoardState }).board;
  }

  it("round-trips several generated full-army boards", () => {
    for (let seed = 0; seed < 3; seed += 1) {
      const white = completeArmy("white", seed * 2 + 100);
      const black = completeArmy("black", seed * 2 + 101);
      const gameState = buildInitialGameState(
        white,
        black,
        STANDARD_BATTLE_CONFIGURATION,
      );
      const block = renderPositionBlock(gameState);

      expect(parsed(parsePositionBlock(block))).toEqual(gameState.board);
    }
  });

  it("round-trips a board with pieces removed - empty cells round-trip too", () => {
    const { board } = fullBoardBlock();

    const sparseBoard: Record<string, PlacedPiece> = { ...board };
    for (const key of Object.keys(board).slice(0, 5)) {
      delete sparseBoard[key];
    }
    const sparseGameState: InitialGameState = {
      ruleset: RULESET_TAG,
      configuration: STANDARD_BATTLE_CONFIGURATION,
      board: sparseBoard,
    };

    const block = renderPositionBlock(sparseGameState);
    expect(parsed(parsePositionBlock(block))).toEqual(sparseBoard);
  });

  it("tolerates CRLF line endings, extra inter-cell spaces, and leading/trailing line whitespace", () => {
    const { board, block } = fullBoardBlock();

    const noisy = block
      .split("\n")
      .map((line) => `  ${line.replaceAll(" ", "   ")}  `)
      .join("\r\n");

    expect(parsed(parsePositionBlock(noisy))).toEqual(board);
  });

  it("rejects a block with too few rows", () => {
    const { block } = fullBoardBlock();
    const tooFewRows = block.split("\n").slice(0, 11).join("\n");

    expect(parsePositionBlock(tooFewRows)).toEqual({
      kind: "error",
      error: { kind: "wrongRowCount", rowCount: 11, expectedRowCount: 12 },
    });
  });

  it("rejects a block with too many rows", () => {
    const { block } = fullBoardBlock();
    const tooManyRows = `${block}\n${block.split("\n")[0]}`;

    expect(parsePositionBlock(tooManyRows)).toEqual({
      kind: "error",
      error: { kind: "wrongRowCount", rowCount: 13, expectedRowCount: 12 },
    });
  });

  it("rejects a row that is not 12 cells", () => {
    const { block } = fullBoardBlock();
    const lines = block.split("\n");
    // Line 0 is row 12 (top row of the block).
    lines[0] = lines[0].split(" ").slice(0, 11).join(" ");

    expect(parsePositionBlock(lines.join("\n"))).toEqual({
      kind: "error",
      error: {
        kind: "wrongCellCount",
        row: 12,
        cellCount: 11,
        expectedCellCount: 12,
      },
    });
  });

  it("rejects a cell matching none of the four cell forms", () => {
    const { block } = fullBoardBlock();
    const lines = block.split("\n");
    // Line 11 is row 1 (bottom row); column index 0 is column A.
    const cells = lines[11].split(" ");
    cells[0] = "???";
    lines[11] = cells.join(" ");

    expect(parsePositionBlock(lines.join("\n"))).toEqual({
      kind: "error",
      error: {
        kind: "unrecognizedCell",
        square: { column: "A", row: 1 },
        cell: "???",
      },
    });
  });

  it("rejects a piece symbol not in PIECE_CATALOG", () => {
    const { block } = fullBoardBlock();
    const lines = block.split("\n");
    // Line 11 is row 1 (bottom row); column index 1 is column B.
    const cells = lines[11].split(" ");
    cells[1] = "[Z]";
    lines[11] = cells.join(" ");

    expect(parsePositionBlock(lines.join("\n"))).toEqual({
      kind: "error",
      error: {
        kind: "unknownPieceSymbol",
        square: { column: "B", row: 1 },
        symbol: "Z",
      },
    });
  });

  it("rejects a lake cell (XXX) that is not exactly on one of the 12 lake squares", () => {
    const { block } = fullBoardBlock();
    const lines = block.split("\n");
    // Line 11 is row 1 (bottom row); column index 0 is column A - not a lake square.
    const cells = lines[11].split(" ");
    cells[0] = "XXX";
    lines[11] = cells.join(" ");

    expect(parsePositionBlock(lines.join("\n"))).toEqual({
      kind: "error",
      error: {
        kind: "lakeCellOffLake",
        square: { column: "A", row: 1 },
      },
    });
  });

  it("rejects a lake square whose cell is not XXX", () => {
    const { block } = fullBoardBlock();
    const lines = block.split("\n");
    // Row 6 is line index 6 (12 - 6); column index 1 is column B, a lake square.
    const cells = lines[6].split(" ");
    expect(cells[1]).toBe("XXX");
    cells[1] = "---";
    lines[6] = cells.join(" ");

    expect(parsePositionBlock(lines.join("\n"))).toEqual({
      kind: "error",
      error: {
        kind: "lakeSquareNotXxx",
        square: { column: "B", row: 6 },
        cell: "---",
      },
    });
  });

  it("does not check army composition or counts - accepts an arbitrary sparse board", () => {
    const gameState: InitialGameState = {
      ruleset: RULESET_TAG,
      configuration: STANDARD_BATTLE_CONFIGURATION,
      board: {
        A1: { side: "white", pieceType: "flag" },
      },
    };
    const block = renderPositionBlock(gameState);

    expect(parsed(parsePositionBlock(block))).toEqual(gameState.board);
  });
});

// Story 00000023, Step 3: the position-block render/parse and
// `buildInitialGameState`'s layout validation, exercised on the Skirmish
// edition (8x8) instead of the Battle default, to confirm they are
// genuinely sized to the resolved edition's `BoardLayout` rather than
// hardcoding Battle's 12x12 grid. (The army itself is not yet
// edition-driven - Step 4 - so these use small, hand-built boards rather
// than a `buildInitialGameState`-produced complete Skirmish army: Skirmish's
// 24-square home zone cannot yet hold Battle's 25-piece roster.)
describe("position-block render/parse on the Skirmish edition (8x8)", () => {
  it("renders a hand-constructed Skirmish placement to an 8-line, 8-cell-per-line block", () => {
    // A1 = White Flag, H3 = White Master-of-Arms (last White home row/column),
    // A6 = Black Champion, H8 = Black Tower (Black's home corner). Every
    // other square is either empty (---) or one of the two 2x2 lakes on rows
    // 4-5, per the `O L L O O L L O` pattern.
    const gameState: InitialGameState = {
      ruleset: SKIRMISH_EDITION.id,
      configuration: STANDARD_SKIRMISH_CONFIGURATION,
      board: {
        A1: { side: "white", pieceType: "flag" },
        H3: { side: "white", pieceType: "masterOfArms" },
        A6: { side: "black", pieceType: "champion" },
        H8: { side: "black", pieceType: "tower" },
      },
    };

    const expected = [
      "--- --- --- --- --- --- --- *T*",
      "--- --- --- --- --- --- --- ---",
      "*2* --- --- --- --- --- --- ---",
      "--- XXX XXX --- --- XXX XXX ---",
      "--- XXX XXX --- --- XXX XXX ---",
      "--- --- --- --- --- --- --- [1]",
      "--- --- --- --- --- --- --- ---",
      "[F] --- --- --- --- --- --- ---",
    ].join("\n");

    expect(renderPositionBlock(gameState)).toBe(expected);
  });

  it("round-trips a hand-built Skirmish board through render and parse", () => {
    const board: BoardState = {
      A1: { side: "white", pieceType: "flag" },
      H3: { side: "white", pieceType: "masterOfArms" },
      A6: { side: "black", pieceType: "champion" },
      H8: { side: "black", pieceType: "tower" },
    };
    const gameState: InitialGameState = {
      ruleset: SKIRMISH_EDITION.id,
      configuration: STANDARD_SKIRMISH_CONFIGURATION,
      board,
    };
    const block = renderPositionBlock(gameState);

    const result = parsePositionBlock(
      block,
      STANDARD_SKIRMISH_CONFIGURATION.boardLayout,
    );
    expect(result.kind).toBe("parsed");
    expect((result as { kind: "parsed"; board: BoardState }).board).toEqual(
      board,
    );
  });

  it("rejects an 8x8 block against the Battle-default (12x12) parse", () => {
    const gameState: InitialGameState = {
      ruleset: SKIRMISH_EDITION.id,
      configuration: STANDARD_SKIRMISH_CONFIGURATION,
      board: { A1: { side: "white", pieceType: "flag" } },
    };
    const block = renderPositionBlock(gameState);

    expect(parsePositionBlock(block)).toEqual({
      kind: "error",
      error: { kind: "wrongRowCount", rowCount: 8, expectedRowCount: 12 },
    });
  });

  it("buildInitialGameState rejects placement states on a different board layout than the given edition", () => {
    const white = emptyPlacement(
      "white",
      STANDARD_SKIRMISH_CONFIGURATION.boardLayout,
      STANDARD_SKIRMISH_CONFIGURATION.army,
      SKIRMISH_EDITION.towerPlacement,
    );
    const black = emptyPlacement(
      "black",
      STANDARD_SKIRMISH_CONFIGURATION.boardLayout,
      STANDARD_SKIRMISH_CONFIGURATION.army,
      SKIRMISH_EDITION.towerPlacement,
    );
    // Battle passed against Skirmish-layout placement states: the mismatch is
    // rejected rather than silently played on the wrong board.
    expect(() =>
      buildInitialGameState(white, black, STANDARD_BATTLE_CONFIGURATION),
    ).toThrow();
  });

  it("rejects placement states whose TOWER_PLACEMENT variant disagrees with the given edition (story 00000025)", () => {
    const white = emptyPlacement(
      "white",
      STANDARD_SKIRMISH_CONFIGURATION.boardLayout,
      STANDARD_SKIRMISH_CONFIGURATION.army,
      "spacing_only", // SKIRMISH_EDITION (2-1:SKIRMISH) itself is spacing_and_lanes.
    );
    const black = emptyPlacement(
      "black",
      STANDARD_SKIRMISH_CONFIGURATION.boardLayout,
      STANDARD_SKIRMISH_CONFIGURATION.army,
      SKIRMISH_EDITION.towerPlacement,
    );
    // A placement built under the historical spacing_only variant, sealed
    // into the active spacing_and_lanes edition's game state: rejected
    // rather than silently played under the wrong variant.
    expect(() =>
      buildInitialGameState(white, black, STANDARD_SKIRMISH_CONFIGURATION),
    ).toThrow();
  });
});

// Story 00000030, Step 7: closes the record loop for Clash through the real
// writer - the Clash configuration (`asymmetric_100` / `standard_clash`,
// built via `games.ts` exactly as the picker will build one) must stamp the
// exact three-token `Ruleset` tag the Grounding facts specify, and its
// position block must be sized and marked for the new 10x10 geometry.
describe("Clash (asymmetric_100 / standard_clash) - story 00000030, Step 7", () => {
  const CLASH_CONFIGURATION = buildGameConfiguration("clash");

  function completeClashArmy(
    side: "white" | "black",
    seed: number,
  ): PlacementState {
    return autoFillOrThrow(
      emptyPlacement(
        side,
        CLASH_CONFIGURATION.boardLayout,
        CLASH_CONFIGURATION.army,
        CLASH_CONFIGURATION.edition.towerPlacement,
      ),
      seededRandom(seed),
    );
  }

  it("buildInitialGameState stamps the exact three-token Clash Ruleset tag", () => {
    const white = completeClashArmy("white", 30);
    const black = completeClashArmy("black", 31);
    const gameState = buildInitialGameState(white, black, CLASH_CONFIGURATION);

    expect(gameState.ruleset).toBe(
      "2-0:BATTLE ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100",
    );
  });

  it("renderPositionBlock is 10 rows of 10 cells, with XXX at columns A/D/G/H/I on rows 5 and 6 only", () => {
    const white = completeClashArmy("white", 32);
    const black = completeClashArmy("black", 33);
    const gameState = buildInitialGameState(white, black, CLASH_CONFIGURATION);

    const lines = renderPositionBlock(gameState).split("\n");
    expect(lines).toHaveLength(10);
    for (const line of lines) {
      const cells = line.split(" ");
      expect(cells).toHaveLength(10);
      for (const cell of cells) {
        expect(cell).toHaveLength(3);
      }
    }

    // Rows 6 and 5 are the 5th and 6th lines from the top (row 10 is the
    // first line, row 1 the last): row 6 -> index 4, row 5 -> index 5.
    const lakeColumnIndexes = [0, 3, 6, 7, 8]; // A, D, G, H, I
    const openColumnIndexes = [1, 2, 4, 5, 9]; // B, C, E, F, J
    const row6 = lines[4].split(" ");
    const row5 = lines[5].split(" ");
    for (const index of lakeColumnIndexes) {
      expect(row6[index]).toBe("XXX");
      expect(row5[index]).toBe("XXX");
    }
    for (const index of openColumnIndexes) {
      expect(row6[index]).not.toBe("XXX");
      expect(row5[index]).not.toBe("XXX");
    }

    // No other row carries a lake cell.
    for (const [lineIndex, line] of lines.entries()) {
      if (lineIndex === 4 || lineIndex === 5) {
        continue;
      }
      expect(line.split(" ")).not.toContain("XXX");
    }
  });
});

describe("deriveBoardLayoutFromPositionBlock - story 00000030, Step 8", () => {
  it("derives dimensions and lake cells straight off a hand-built block, in the block's own bottom-up row numbering", () => {
    // 3 rows x 4 columns. Top line (first) is row 3, bottom line (last) is
    // row 1 - `renderPositionBlock`'s convention, this function's inverse.
    const block = [
      "--- XXX --- ---", // row 3: lake at column index 1
      "--- --- --- ---", // row 2: no lake
      "XXX --- --- XXX", // row 1: lake at column indices 0 and 3
    ].join("\n");

    const layout = deriveBoardLayoutFromPositionBlock(block);

    expect(layout.id).toBe(DERIVED_BOARD_LAYOUT_ID);
    expect(layout.rowCount).toBe(3);
    expect(layout.columnCount).toBe(4);
    expect(layout.homeRowsPerSide).toBe(0);
    expect(layout.hasBuffer).toBe(false);
    expect(layout.lakeRows).toEqual([1, 3]);
    expect(layout.lakeColumnIndices).toEqual([0, 1, 3]);
  });

  it("derives a lakeless board when the block has no XXX cells at all", () => {
    const block = ["--- --- ---", "--- --- ---"].join("\n");

    const layout = deriveBoardLayoutFromPositionBlock(block);

    expect(layout.rowCount).toBe(2);
    expect(layout.columnCount).toBe(3);
    expect(layout.lakeRows).toEqual([]);
    expect(layout.lakeColumnIndices).toEqual([]);
  });

  it("is total: an empty block derives a degenerate 0x0 layout rather than throwing", () => {
    expect(() => deriveBoardLayoutFromPositionBlock("")).not.toThrow();

    const layout = deriveBoardLayoutFromPositionBlock("");
    expect(layout.id).toBe(DERIVED_BOARD_LAYOUT_ID);
    expect(layout.rowCount).toBe(0);
    expect(layout.columnCount).toBe(0);
    expect(layout.lakeRows).toEqual([]);
    expect(layout.lakeColumnIndices).toEqual([]);
  });

  it("is total: a ragged block (rows of different widths) derives without throwing, column count from the first line only", () => {
    const raggedBlock = ["--- --- ---", "--- ---", "XXX --- --- ---"].join(
      "\n",
    );

    expect(() => deriveBoardLayoutFromPositionBlock(raggedBlock)).not.toThrow();

    const layout = deriveBoardLayoutFromPositionBlock(raggedBlock);
    expect(layout.rowCount).toBe(3);
    expect(layout.columnCount).toBe(3);
  });

  it("tolerates CRLF line endings and leading/trailing whitespace, matching parsePositionBlock's own tolerance", () => {
    const block = ["  XXX --- ---  ", " --- --- --- "].join("\r\n");

    const layout = deriveBoardLayoutFromPositionBlock(block);

    expect(layout.rowCount).toBe(2);
    expect(layout.columnCount).toBe(3);
    expect(layout.lakeRows).toEqual([2]);
    expect(layout.lakeColumnIndices).toEqual([0]);
  });
});
