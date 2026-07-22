import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { hasAnyLegalPly, legalAttacks, legalDestinations } from "./movement.ts";
import type { PieceTypeId } from "./pieces.ts";

// Fixtures in this file use only pieces whose id and rank are identical in
// both the 1.1 and 1.2 rosters (champion, knight, militia, tower, flag) - see
// the implementation plan's cross-step test constraint - so they remain
// valid unchanged through the roster swap (Step 5).

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

/** Sorts destinations for order-independent comparison. */
function sortedKeys(squares: readonly Square[]): string[] {
  return squares.map((s) => `${s.column}${s.row}`).sort();
}

describe("legalDestinations (ruleset 1.2, empty-square moves only)", () => {
  it("gives an unencumbered piece its four one-square and four two-square orthogonal empties in open space", () => {
    const state = board([["D5", "white", "champion"]]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(
      ["C5", "E5", "D4", "D6", "B5", "F5", "D3", "D7"].sort(),
    );
  });

  it("prunes off-board directions at a corner, for both the one- and two-square options", () => {
    const state = board([["A1", "white", "champion"]]);
    const destinations = legalDestinations(state, { column: "A", row: 1 });
    expect(sortedKeys(destinations)).toEqual(["A2", "B1", "A3", "C1"].sort());
  });

  it("limits a piece with an adjacent enemy to its one-square steps only (encumbered)", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "militia"], // adjacent enemy - encumbers the champion
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    // D6 is occupied (an attack target, not a destination); no two-square
    // options anywhere, since encumbrance is judged once at the origin.
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "E5"].sort());
  });

  it("offers the two-square option again once the enemy is no longer adjacent (unencumbered)", () => {
    // The enemy militia is two squares away (D7), not in any of D5's eight
    // surrounding squares, so the champion is unencumbered.
    const state = board([
      ["D5", "white", "champion"],
      ["D7", "black", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    // D6 (the intermediate square) is offered as a plain one-square move;
    // D7 itself is occupied by an enemy, so it is never in this array (it is
    // offered separately, as an attack - see legalAttacks below).
    expect(sortedKeys(destinations)).toEqual(
      ["C5", "E5", "D4", "D6", "B5", "F5", "D3"].sort(),
    );
    expect(destinations.some((s) => s.column === "D" && s.row === 7)).toBe(
      false,
    );
  });

  it("blocks the two-square option through an occupied intermediate square, without losing other directions", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "white", "militia"], // friendly, blocks the intermediate square
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    // Still unencumbered (a friendly piece never encumbers), so the other
    // three directions keep both their one- and two-square options; D6 is
    // occupied (excluded) and D7 is unreachable through it.
    expect(sortedKeys(destinations)).toEqual(
      ["C5", "E5", "D4", "B5", "F5", "D3"].sort(),
    );
  });

  it("excludes an adjacent lake square as a destination and blocks the two-square option through it", () => {
    // A6 is not itself a lake (column A is not a lake column), but its
    // neighbor B6 is (lake columns B, C, F, G, J, K on rows 6-7).
    const state = board([["A6", "white", "champion"]]);
    const destinations = legalDestinations(state, { column: "A", row: 6 });
    // Up/down keep both one- and two-square options; rightward into the
    // lake is fully blocked (no B6, no C6 - the lake is never a legal
    // intermediate square).
    expect(sortedKeys(destinations)).toEqual(["A5", "A7", "A4", "A8"].sort());
    expect(destinations.some((s) => s.column === "B")).toBe(false);
    expect(destinations.some((s) => s.column === "C")).toBe(false);
  });

  it("excludes a two-square destination when the far square is a lake, even with a clear intermediate square", () => {
    // C is a lake column; C6/C7 are lake squares. From C4, moving down: C5
    // (row 5) is a clear intermediate, but C6 (row 6) is a lake.
    const state = board([["C4", "white", "champion"]]);
    const destinations = legalDestinations(state, { column: "C", row: 4 });
    expect(destinations.some((s) => s.column === "C" && s.row === 5)).toBe(
      true,
    );
    expect(destinations.some((s) => s.column === "C" && s.row === 6)).toBe(
      false,
    );
  });

  it("excludes an adjacent square occupied by a friendly piece", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "white", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(destinations.some((s) => s.column === "D" && s.row === 6)).toBe(
      false,
    );
  });

  it("excludes an adjacent square occupied by an enemy piece", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(destinations.some((s) => s.column === "D" && s.row === 6)).toBe(
      false,
    );
  });

  it("gives Tower no destinations", () => {
    const state = board([["A1", "white", "tower"]]);
    expect(legalDestinations(state, { column: "A", row: 1 })).toEqual([]);
  });

  it("gives Flag no destinations", () => {
    const state = board([["A1", "white", "flag"]]);
    expect(legalDestinations(state, { column: "A", row: 1 })).toEqual([]);
  });

  it("gives no destinations for an empty origin square", () => {
    const state = board([]);
    expect(legalDestinations(state, { column: "D", row: 5 })).toEqual([]);
  });

  it("never returns a diagonal destination", () => {
    const state = board([["E9", "black", "knight"]]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    for (const destination of destinations) {
      const sameColumn = destination.column === "E";
      const sameRow = destination.row === 9;
      // Exactly one of column/row must match the origin - never both
      // different (diagonal) and never both the same (the origin itself).
      expect(sameColumn !== sameRow).toBe(true);
    }
  });

  it("moves a Knight the same as any other piece type - one square baseline, two when unencumbered", () => {
    const state = board([["D5", "white", "knight"]]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(
      ["C5", "E5", "D4", "D6", "B5", "F5", "D3", "D7"].sort(),
    );
  });
});

describe("hasAnyLegalPly", () => {
  it("is true when at least one of the side's pieces has a legal destination", () => {
    const state = board([["D5", "white", "champion"]]);
    expect(hasAnyLegalPly(state, "white")).toBe(true);
  });

  it("is false for a side with no pieces on the board", () => {
    const state = board([["D5", "black", "champion"]]);
    expect(hasAnyLegalPly(state, "white")).toBe(false);
  });

  it("is true for a piece with only an attack available (no legal destination)", () => {
    // Boxed in on every non-attack direction by friendly pieces/the edge,
    // but with an adjacent enemy to attack.
    const state = board([
      ["A1", "white", "champion"],
      ["A2", "white", "militia"], // friendly, blocks the only other empty direction
      ["B1", "black", "militia"], // adjacent enemy - a legal, sacrificial attack
    ]);
    expect(legalDestinations(state, { column: "A", row: 1 })).toEqual([]);
    expect(hasAnyLegalPly(state, "white")).toBe(true);
  });

  it("is false for a side that is truly boxed in - no legal move and no legal attack anywhere", () => {
    // A single mobile White piece in a corner, walled in by two friendly
    // *Towers* (immobile, so they never contribute a legal ply of their
    // own - unlike a mobile piece, which would itself have somewhere to go
    // and defeat the point of this fixture), with no enemy piece anywhere on
    // the board to attack.
    const state = board([
      ["A1", "white", "champion"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
    ]);
    expect(hasAnyLegalPly(state, "white")).toBe(false);
  });
});

describe("legalAttacks (ruleset 1.2, enemy-occupied attack targets)", () => {
  it("offers a baseline piece exactly its adjacent enemy squares", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "militia"], // adjacent enemy - offered
      ["D4", "white", "militia"], // adjacent friendly - excluded
      ["C5", "black", "militia"], // adjacent enemy - offered
      // E5 left empty - excluded
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["C5", "D6"].sort());
  });

  it("offers an adjacent enemy Flag as an attack target", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("never offers a friendly Flag as an attack target", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "white", "flag"],
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(attacks).toEqual([]);
  });

  it("offers a two-square line ending on an enemy as an attack when unencumbered", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D7", "black", "militia"], // D6 clear between them, no other enemy nearby
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D7"]);
  });

  it("does not offer a two-square attack through an occupied intermediate square", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "militia"], // blocker at distance 1 - itself an ordinary attack target
      ["D7", "black", "militia"], // would-be two-square target at distance 2
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("does not offer a two-square attack through a lake intermediate square", () => {
    // B is a lake column; B6/B7 are lake squares.
    const state = board([
      ["B5", "white", "champion"],
      ["B8", "black", "militia"],
    ]);
    const attacks = legalAttacks(state, { column: "B", row: 5 });
    expect(attacks.some((s) => s.column === "B" && s.row === 8)).toBe(false);
  });

  it("withholds the two-square attack once an adjacent enemy encumbers the piece", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["C5", "black", "militia"], // adjacent enemy - encumbers the champion
      ["D7", "black", "militia"], // otherwise a clear two-square line
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    // Only the adjacent enemy is offered; the far one is unreachable while
    // encumbered.
    expect(sortedKeys(attacks)).toEqual(["C5"]);
  });

  it("gives Tower no attack targets", () => {
    const state = board([
      ["A1", "white", "tower"],
      ["A2", "black", "militia"],
    ]);
    expect(legalAttacks(state, { column: "A", row: 1 })).toEqual([]);
  });

  it("gives Flag no attack targets", () => {
    const state = board([
      ["A1", "white", "flag"],
      ["A2", "black", "militia"],
    ]);
    expect(legalAttacks(state, { column: "A", row: 1 })).toEqual([]);
  });

  it("gives no attack targets for an empty origin square", () => {
    const state = board([]);
    expect(legalAttacks(state, { column: "D", row: 5 })).toEqual([]);
  });

  it("never returns a diagonal attack target", () => {
    const state = board([
      ["E9", "black", "knight"],
      ["D8", "white", "militia"], // diagonally adjacent - must never be offered
      ["F10", "white", "militia"], // diagonally adjacent - must never be offered
    ]);
    const attacks = legalAttacks(state, { column: "E", row: 9 });
    for (const attack of attacks) {
      const sameColumn = attack.column === "E";
      const sameRow = attack.row === 9;
      expect(sameColumn !== sameRow).toBe(true);
    }
  });
});
