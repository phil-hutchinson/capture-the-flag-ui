import { describe, expect, it } from "vitest";
import { ORTHOGONAL_DIRECTIONS, type Direction, type Square } from "./board.ts";
import { isEncumbered, legalAttacks, legalDestinations } from "./movement.ts";
import { EMPTY_POSITION, placePiece, type NumberedPiece } from "./position.ts";
import { generateStartPosition, type RandomSource } from "./startPosition.ts";

/**
 * A tiny deterministic PRNG (mulberry32, public domain), copied per test file
 * per this story's convention (Decision 7) so no dependency is added for it.
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

const whiteNumbered = (rank: 1 | 2 | 3 | 4 | 5): NumberedPiece => ({
  side: "white",
  kind: "numbered",
  rank,
});
const blackNumbered = (rank: 1 | 2 | 3 | 4 | 5): NumberedPiece => ({
  side: "black",
  kind: "numbered",
  rank,
});

const D4: Square = { column: "D", row: 4 };
const D5: Square = { column: "D", row: 5 };
const D6: Square = { column: "D", row: 6 };
const D3: Square = { column: "D", row: 3 };
const C4: Square = { column: "C", row: 4 };
const C5: Square = { column: "C", row: 5 };
const E4: Square = { column: "E", row: 4 };
const E5: Square = { column: "E", row: 5 };
const C3: Square = { column: "C", row: 3 };
const E3: Square = { column: "E", row: 3 };

const ALL_DIRECTIONS: readonly Direction[] = [
  "north",
  "south",
  "east",
  "west",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
];

/** The neighbor square of `D4` in each of the eight compass directions. */
const NEIGHBOR_OF: Readonly<Record<Direction, Square>> = {
  north: D5,
  south: D3,
  east: E4,
  west: C4,
  northeast: E5,
  northwest: C5,
  southeast: E3,
  southwest: C3,
};

/**
 * The five directions that encumber travel in each orthogonal direction
 * (rules.md §4.2, glossary "Encumbered"), restated independently here (not
 * imported from `movement.ts`) so this test is a real check of the module's
 * behaviour rather than a tautology.
 */
const ENCUMBERING: Readonly<Record<Direction, readonly Direction[]>> = {
  north: ["northwest", "north", "northeast", "west", "east"],
  south: ["southwest", "south", "southeast", "west", "east"],
  east: ["northeast", "east", "southeast", "north", "south"],
  west: ["northwest", "west", "southwest", "north", "south"],
  northeast: [],
  northwest: [],
  southeast: [],
  southwest: [],
};

describe("movement (ruleset major 3): orthogonal steps and direction-relative encumbrance", () => {
  describe("isEncumbered", () => {
    for (const travelDirection of ORTHOGONAL_DIRECTIONS) {
      describe(`traveling ${travelDirection}`, () => {
        for (const neighborDirection of ALL_DIRECTIONS) {
          const shouldEncumber =
            ENCUMBERING[travelDirection].includes(neighborDirection);
          it(`an enemy to the ${neighborDirection} ${shouldEncumber ? "encumbers" : "does not encumber"}`, () => {
            const position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
            const withEnemy = placePiece(
              position,
              NEIGHBOR_OF[neighborDirection],
              blackNumbered(3),
            );
            expect(isEncumbered(withEnemy, D4, "white", travelDirection)).toBe(
              shouldEncumber,
            );
          });
        }
      });
    }

    it("a friendly piece never encumbers, even on an ahead-or-beside square", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      position = placePiece(position, C5, whiteNumbered(3)); // northwest - would encumber north if it were an enemy
      expect(isEncumbered(position, D4, "white", "north")).toBe(false);
    });

    it("the same piece can be encumbered one way and unencumbered another, in a single position", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      // An enemy directly behind (south) is one of the three squares that
      // never encumber a northward move, so north stays free - while it sits
      // squarely in south's own ahead-or-beside set (and in both east's and
      // west's, as a perpendicular "beside" square), restricting all three.
      position = placePiece(position, D3, blackNumbered(3));
      expect(isEncumbered(position, D4, "white", "north")).toBe(false);
      expect(isEncumbered(position, D4, "white", "south")).toBe(true);
      expect(isEncumbered(position, D4, "white", "east")).toBe(true);
      expect(isEncumbered(position, D4, "white", "west")).toBe(true);
    });
  });

  describe("legalDestinations and legalAttacks", () => {
    it("a lone piece in open ground has four one-square and four two-square destinations", () => {
      const position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      const destinations = legalDestinations(position, D4);
      expect(destinations).toHaveLength(8);
      expect(destinations).toEqual(
        expect.arrayContaining([
          { column: "D", row: 5 },
          { column: "D", row: 3 },
          { column: "E", row: 4 },
          { column: "C", row: 4 },
          { column: "D", row: 6 },
          { column: "D", row: 2 },
          { column: "F", row: 4 },
          { column: "B", row: 4 },
        ]),
      );
      expect(legalAttacks(position, D4)).toEqual([]);
    });

    it("a lone piece at a corner has two one-square and two two-square destinations", () => {
      const corner: Square = { column: "A", row: 1 };
      const position = placePiece(EMPTY_POSITION, corner, whiteNumbered(3));
      const destinations = legalDestinations(position, corner);
      expect(destinations).toEqual(
        expect.arrayContaining([
          { column: "A", row: 2 },
          { column: "B", row: 1 },
          { column: "A", row: 3 },
          { column: "C", row: 1 },
        ]),
      );
      expect(destinations).toHaveLength(4);
    });

    it("an enemy directly behind does not stop the two-square move forward", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      position = placePiece(position, D3, blackNumbered(3)); // south - behind for a north move
      expect(legalDestinations(position, D4)).toEqual(
        expect.arrayContaining([D5, D6]),
      );
    });

    it("an enemy ahead, beside, or on a forward diagonal refuses the two-square move but leaves the one-square move legal", () => {
      const cases: { readonly label: string; readonly enemySquare: Square }[] =
        [
          { label: "northwest", enemySquare: C5 },
          { label: "northeast", enemySquare: E5 },
          { label: "west", enemySquare: C4 },
          { label: "east", enemySquare: E4 },
        ];
      for (const { enemySquare } of cases) {
        let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
        position = placePiece(position, enemySquare, blackNumbered(3));
        const destinations = legalDestinations(position, D4);
        expect(destinations).toContainEqual(D5);
        expect(destinations).not.toContainEqual(D6);
      }
    });

    it("the two-square move is refused when the passed-through square is occupied, even by a friendly piece that causes no encumbrance", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      position = placePiece(position, D5, whiteNumbered(2)); // friendly, blocks the passed-through square
      expect(isEncumbered(position, D4, "white", "north")).toBe(false);
      const destinations = legalDestinations(position, D4);
      expect(destinations).not.toContainEqual(D5);
      expect(destinations).not.toContainEqual(D6);
    });

    it("the two-square move is refused when the passed-through square is occupied by an enemy too", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      position = placePiece(position, D5, blackNumbered(2));
      const destinations = legalDestinations(position, D4);
      expect(destinations).not.toContainEqual(D6);
      expect(legalAttacks(position, D4)).toContainEqual(D5);
    });

    it("a two-square move onto an enemy is an attack target, not a destination", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(5));
      position = placePiece(position, D6, blackNumbered(1));
      expect(legalAttacks(position, D4)).toContainEqual(D6);
      expect(legalDestinations(position, D4)).not.toContainEqual(D6);
    });

    it("the Flag has no moves and no attacks", () => {
      let position = placePiece(EMPTY_POSITION, D4, {
        side: "white",
        kind: "flag",
      });
      position = placePiece(position, D5, blackNumbered(1));
      expect(legalDestinations(position, D4)).toEqual([]);
      expect(legalAttacks(position, D4)).toEqual([]);
    });

    it("no move ever lands on a friendly piece", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      for (const direction of ORTHOGONAL_DIRECTIONS) {
        position = placePiece(
          position,
          NEIGHBOR_OF[direction],
          whiteNumbered(1),
        );
      }
      expect(legalDestinations(position, D4)).toEqual([]);
      expect(legalAttacks(position, D4)).toEqual([]);
    });

    it("no diagonal destination or attack is ever produced", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      for (const diagonal of [
        "northeast",
        "northwest",
        "southeast",
        "southwest",
      ] as const) {
        position = placePiece(
          position,
          NEIGHBOR_OF[diagonal],
          blackNumbered(1),
        );
      }
      const isDiagonalFromOrigin = (square: Square) =>
        square.column !== D4.column && square.row !== D4.row;
      for (const square of [
        ...legalDestinations(position, D4),
        ...legalAttacks(position, D4),
      ]) {
        expect(isDiagonalFromOrigin(square)).toBe(false);
      }
    });

    it("with the first-move flag set, every result for a White piece is one square away; with it clear, two-square results reappear", () => {
      const position = placePiece(EMPTY_POSITION, D4, whiteNumbered(3));
      const restricted = legalDestinations(position, D4, true);
      expect(restricted).toHaveLength(4);
      expect(restricted).toEqual(expect.arrayContaining([D5, D3, E4, C4]));

      const unrestricted = legalDestinations(position, D4, false);
      expect(unrestricted).toHaveLength(8);
    });

    it("the first-move flag also withholds two-square attacks", () => {
      let position = placePiece(EMPTY_POSITION, D4, whiteNumbered(5));
      position = placePiece(position, D6, blackNumbered(1));
      expect(legalAttacks(position, D4, true)).not.toContainEqual(D6);
      expect(legalAttacks(position, D4, false)).toContainEqual(D6);
    });
  });

  describe("from a generated starting position", () => {
    it("White has exactly 8 legal first moves, each of one square, in each of several generated positions", () => {
      const random = seededRandom(7);
      for (let sample = 0; sample < 10; sample += 1) {
        const { position } = generateStartPosition(random);
        const whiteSquares = Object.entries(position)
          .filter(([, piece]) => piece.side === "white")
          .map(([key]) => ({
            column: key[0],
            row: Number(key.slice(1)),
          }));

        const moves: { readonly origin: Square; readonly target: Square }[] =
          [];
        for (const origin of whiteSquares) {
          for (const target of legalDestinations(position, origin, true)) {
            moves.push({ origin, target });
          }
          for (const target of legalAttacks(position, origin, true)) {
            moves.push({ origin, target });
          }
        }

        expect(moves).toHaveLength(8);
        for (const { origin, target } of moves) {
          // Every opening move is a single square north (into the empty
          // open ground) - one per front-row piece.
          expect(target.column).toBe(origin.column);
          expect(target.row - origin.row).toBe(1);
        }
      }
    });
  });
});
