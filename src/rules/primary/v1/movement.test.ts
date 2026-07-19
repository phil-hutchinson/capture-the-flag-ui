import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { hasAnyLegalPly, legalAttacks, legalDestinations } from "./movement.ts";
import type { PieceTypeId } from "./pieces.ts";

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

describe("legalDestinations (ruleset PRIMARY:1.1, empty-square moves only)", () => {
  it("gives a baseline piece its four orthogonal empties in open space", () => {
    const state = board([["D5", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "D6", "E5"].sort());
  });

  it("prunes off-board directions at a corner", () => {
    const state = board([["A1", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "A", row: 1 });
    expect(sortedKeys(destinations)).toEqual(["A2", "B1"].sort());
  });

  it("prunes off-board directions at an edge", () => {
    const state = board([["A5", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "A", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["A4", "A6", "B5"].sort());
  });

  it("excludes an adjacent lake square as a destination", () => {
    // A6 is not itself a lake (column A is not a lake column), but its
    // neighbor B6 is (lake columns B, C, F, G, J, K on rows 6-7).
    const state = board([["A6", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "A", row: 6 });
    expect(sortedKeys(destinations)).toEqual(["A5", "A7"].sort());
    expect(destinations.some((s) => s.column === "B" && s.row === 6)).toBe(
      false,
    );
  });

  it("excludes an adjacent square occupied by a friendly piece", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "white", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "E5"].sort());
  });

  it("excludes an adjacent square occupied by an enemy piece", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "E5"].sort());
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
    const state = board([["E9", "black", "skirmisher"]]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    for (const destination of destinations) {
      const sameColumn = destination.column === "E";
      const sameRow = destination.row === 9;
      // Exactly one of column/row must match the origin - never both
      // different (diagonal) and never both the same (the origin itself).
      expect(sameColumn !== sameRow).toBe(true);
    }
  });

  it("lets a Skirmisher reach up to 3 squares in a clear straight line, in every direction", () => {
    const state = board([["E9", "black", "skirmisher"]]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    expect(sortedKeys(destinations)).toEqual(
      [
        "E6",
        "E7",
        "E8", // up
        "E10",
        "E11",
        "E12", // down
        "B9",
        "C9",
        "D9", // left
        "F9",
        "G9",
        "H9", // right
      ].sort(),
    );
  });

  it("stops a Skirmisher's ray short when it would enter a lake, excluding the lake square", () => {
    // C is a lake column; C6 and C7 are lake squares. From C9 moving toward
    // row 1, C8 (distance 1) is clear, C7 (distance 2) is a lake.
    const state = board([["C9", "black", "skirmisher"]]);
    const destinations = legalDestinations(state, { column: "C", row: 9 });
    const upward = destinations.filter((s) => s.column === "C" && s.row < 9);
    expect(sortedKeys(upward)).toEqual(["C8"]);
  });

  it("stops a Skirmisher's ray short when blocked by a piece, excluding the blocker and everything past it", () => {
    const state = board([
      ["H5", "white", "skirmisher"],
      ["J5", "black", "militia"], // blocker at distance 2 to the right
    ]);
    const destinations = legalDestinations(state, { column: "H", row: 5 });
    const rightward = destinations.filter((s) => s.row === 5 && s.column > "H");
    expect(sortedKeys(rightward)).toEqual(["I5"]);
    expect(rightward.some((s) => s.column === "J" || s.column === "K")).toBe(
      false,
    );
  });

  it("lets a Skirmisher reach exactly 1 square when blocked immediately", () => {
    const state = board([
      ["H5", "white", "skirmisher"],
      ["I5", "black", "militia"], // blocker at distance 1
    ]);
    const destinations = legalDestinations(state, { column: "H", row: 5 });
    const rightward = destinations.filter((s) => s.row === 5 && s.column > "H");
    expect(rightward).toEqual([]);
  });

  it("lets a Skirmisher reach exactly 2 squares when blocked at distance 3", () => {
    const state = board([
      ["E9", "black", "skirmisher"],
      ["H9", "black", "militia"], // friendly blocker at distance 3
    ]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    const rightward = destinations.filter((s) => s.row === 9 && s.column > "E");
    expect(sortedKeys(rightward)).toEqual(["F9", "G9"].sort());
  });

  it("limits a Knight moving without attacking to one square, like a baseline piece", () => {
    const state = board([["D5", "white", "knight"]]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "D6", "E5"].sort());
  });
});

describe("hasAnyLegalPly", () => {
  it("is true when at least one of the side's pieces has a legal destination", () => {
    const state = board([["D5", "white", "infantry"]]);
    expect(hasAnyLegalPly(state, "white")).toBe(true);
  });

  it("is false for a side with no pieces on the board", () => {
    const state = board([["D5", "black", "infantry"]]);
    expect(hasAnyLegalPly(state, "white")).toBe(false);
  });

  it("is true for a piece with only an attack available (no legal destination)", () => {
    // Boxed in on every non-attack direction by friendly pieces/the edge,
    // but with an adjacent enemy to attack.
    const state = board([
      ["A1", "white", "infantry"],
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
      ["A1", "white", "infantry"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
    ]);
    expect(hasAnyLegalPly(state, "white")).toBe(false);
  });
});

describe("legalAttacks (ruleset PRIMARY:1.1, enemy-occupied attack targets)", () => {
  it("offers a baseline piece exactly its adjacent enemy squares", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "militia"], // adjacent enemy - offered
      ["D4", "white", "militia"], // adjacent friendly - excluded
      ["C5", "black", "militia"], // adjacent enemy - offered
      // E5 left empty - excluded
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["C5", "D6"].sort());
  });

  it("offers an adjacent enemy Flag as an attack target for a baseline piece", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "flag"],
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("offers an adjacent enemy Flag as an attack target for an Assassin", () => {
    const state = board([
      ["D5", "white", "assassin"],
      ["D6", "black", "flag"],
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("never offers a friendly Flag as an attack target", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "white", "flag"],
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(attacks).toEqual([]);
  });

  it("offers a Knight a charge onto an enemy Flag at distance 2 and 3 over a clear line", () => {
    const twoAway = board([
      ["D5", "white", "knight"],
      ["D7", "black", "flag"], // D6 clear between them
    ]);
    expect(sortedKeys(legalAttacks(twoAway, { column: "D", row: 5 }))).toEqual([
      "D7",
    ]);

    const threeAway = board([
      ["D5", "white", "knight"],
      ["D8", "black", "flag"], // D6, D7 clear between them
    ]);
    expect(
      sortedKeys(legalAttacks(threeAway, { column: "D", row: 5 })),
    ).toEqual(["D8"]);
  });

  it("cuts a Knight's charge onto a Flag short at a blocking piece", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D6", "black", "militia"], // blocker at distance 1
      ["D7", "black", "flag"], // would-be charge target at distance 2
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("cuts a Knight's charge onto a Flag short at a lake", () => {
    // B is a lake column; B6/B7 are lake squares.
    const state = board([
      ["B5", "white", "knight"],
      ["B8", "black", "flag"],
    ]);
    const attacks = legalAttacks(state, { column: "B", row: 5 });
    expect(attacks.some((s) => s.column === "B" && s.row === 8)).toBe(false);
  });

  it("offers a Skirmisher a rush onto an enemy Flag at distance 1, 2, and 3 over a clear line", () => {
    const oneAway = board([
      ["E9", "black", "skirmisher"],
      ["E8", "white", "flag"],
    ]);
    expect(sortedKeys(legalAttacks(oneAway, { column: "E", row: 9 }))).toEqual([
      "E8",
    ]);

    const threeAway = board([
      ["E9", "black", "skirmisher"],
      ["E6", "white", "flag"],
    ]);
    expect(
      sortedKeys(legalAttacks(threeAway, { column: "E", row: 9 })),
    ).toEqual(["E6"]);
  });

  it("cuts a Skirmisher's rush onto a Flag short at a blocking piece", () => {
    const state = board([
      ["H5", "white", "skirmisher"],
      ["J5", "black", "militia"], // blocker at distance 2
      ["K5", "black", "flag"], // beyond the blocker - unreachable
    ]);
    const attacks = legalAttacks(state, { column: "H", row: 5 });
    const rightward = attacks.filter((s) => s.row === 5 && s.column > "H");
    expect(sortedKeys(rightward)).toEqual(["J5"]);
  });

  it("offers a Knight its adjacent enemy in an ordinary attack", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D6", "black", "militia"],
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("offers a Knight a 2-square charge onto an enemy over a clear line", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D7", "black", "militia"], // D6 clear between them
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D7"]);
  });

  it("offers a Knight a 3-square charge onto an enemy over a clear line", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D8", "black", "militia"], // D6, D7 clear between them
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D8"]);
  });

  it("never offers a Knight a charge onto an empty square", () => {
    const state = board([["D5", "white", "knight"]]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    expect(attacks).toEqual([]);
  });

  it("never offers a Knight a charge through a blocking piece", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D6", "black", "militia"], // blocker at distance 1
      ["D7", "black", "militia"], // would-be charge target at distance 2
    ]);
    const attacks = legalAttacks(state, { column: "D", row: 5 });
    // The distance-1 blocker is itself an ordinary attack target; the
    // distance-2 square is never reachable past it.
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("never offers a Knight a charge through a lake", () => {
    // B is a lake column; B6/B7 are lake squares. From B5, a charge toward
    // row 8 or beyond must cross the lake at B6/B7.
    const state = board([
      ["B5", "white", "knight"],
      ["B8", "black", "militia"],
    ]);
    const attacks = legalAttacks(state, { column: "B", row: 5 });
    expect(attacks.some((s) => s.column === "B" && s.row === 8)).toBe(false);
  });

  it("never offers a Knight a charge onto a Halberdier, while the same Halberdier is offered when adjacent", () => {
    const chargeState = board([
      ["D5", "white", "knight"],
      ["D7", "black", "halberdier"], // D6 clear - would be a 2-square charge
    ]);
    expect(legalAttacks(chargeState, { column: "D", row: 5 })).toEqual([]);

    const adjacentState = board([
      ["D5", "white", "knight"],
      ["D6", "black", "halberdier"],
    ]);
    const attacks = legalAttacks(adjacentState, { column: "D", row: 5 });
    expect(sortedKeys(attacks)).toEqual(["D6"]);
  });

  it("offers a Skirmisher enemies at 1, 2, and 3 squares in a clear line", () => {
    const oneAway = board([
      ["E9", "black", "skirmisher"],
      ["E8", "white", "militia"],
    ]);
    expect(sortedKeys(legalAttacks(oneAway, { column: "E", row: 9 }))).toEqual([
      "E8",
    ]);

    const twoAway = board([
      ["E9", "black", "skirmisher"],
      ["E7", "white", "militia"],
    ]);
    expect(sortedKeys(legalAttacks(twoAway, { column: "E", row: 9 }))).toEqual([
      "E7",
    ]);

    const threeAway = board([
      ["E9", "black", "skirmisher"],
      ["E6", "white", "militia"],
    ]);
    expect(
      sortedKeys(legalAttacks(threeAway, { column: "E", row: 9 })),
    ).toEqual(["E6"]);
  });

  it("cuts a Skirmisher's attack ray short at a lake", () => {
    // C is a lake column; C6/C7 are lake squares. From C9 toward row 1,
    // C8 (distance 1) is clear, C7 (distance 2) is a lake.
    const state = board([
      ["C9", "black", "skirmisher"],
      ["C5", "white", "militia"], // beyond the lake - unreachable
    ]);
    const attacks = legalAttacks(state, { column: "C", row: 9 });
    expect(attacks.filter((s) => s.column === "C")).toEqual([]);
  });

  it("cuts a Skirmisher's attack ray short at a blocking piece, offering only that piece if it is an enemy", () => {
    const state = board([
      ["H5", "white", "skirmisher"],
      ["J5", "black", "militia"], // blocker at distance 2
      ["K5", "black", "militia"], // beyond the blocker - unreachable
    ]);
    const attacks = legalAttacks(state, { column: "H", row: 5 });
    const rightward = attacks.filter((s) => s.row === 5 && s.column > "H");
    expect(sortedKeys(rightward)).toEqual(["J5"]);
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
      ["E9", "black", "skirmisher"],
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
