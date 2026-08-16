// Piece catalog for ruleset major 3 (the proposed pre-release edition - see
// `edition.ts` for its id), written from `reference/rules.md` §2.2 alone -
// never by copying the existing major-2 rule engine.
//
// **Rank 5 is the strongest piece and rank 1 the weakest - the opposite order
// from major 2, where rank 1 is strongest.** This is the single most
// dangerous fact in this story (see story.md's "silent breakages"): a
// consumer that keys artwork or strength off a piece *name* survives
// Master-of-Arms and Champion (they keep their relative place) and is wrong
// for Foot Soldier and Militia, whose names are reused at a different rank.
// Nothing in this codebase may key off a name, or off a bare digit without
// also knowing which major it belongs to - always the pair `(major, rank)`.
//
// Straight from rules.md §2.2: "The number is the rule; the name is
// decoration. Every rule in this document is stated in numbers, and nothing
// anywhere depends on what a rank is called. The names are supplied so that
// players have something to say out loud, and may be changed without
// changing the game."
//
// A piece's rank is **mutable game state**, not a fixed property of a token
// (rules.md §4.3's rank reduction) - see `position.ts` (Step 2), which owns
// that state. This module holds only the fixed catalog: which ranks exist,
// their names, their id digits, and how many of each an army carries.
//
// This module has no knowledge of the board or of combat - it is pure piece
// data - so it has no dependencies elsewhere in this ruleset version.

/**
 * A numbered piece's strength (rules.md §2.2): 5 (strongest) down to 1
 * (weakest). Unlike major 2's `RankCode`, there is no `null` case for an
 * unranked piece type - major 3 has no Towers, and the Flag is modelled
 * separately (see `FLAG_ID_DIGIT` below and `position.ts`'s `PlacedPiece`),
 * so every `Rank` value names an actual numbered piece.
 */
export type Rank = 1 | 2 | 3 | 4 | 5;

/** Every rank, strongest first - the order rules.md §2.2's table lists them in. */
export const RANKS: readonly Rank[] = [5, 4, 3, 2, 1];

/**
 * The single character used to identify a numbered piece's rank - in the
 * position ID (`positionId.ts`, Step 3) and in move notation's `=N` mark
 * (rules.md §4.5). Always equal to the rank's own number as a string; kept as
 * its own field (rather than derived ad hoc at each call site) so every
 * consumer reads the same value.
 */
export type RankIdDigit = "1" | "2" | "3" | "4" | "5";

export interface RankCatalogEntry {
  readonly rank: Rank;
  /** Player-facing name (rules.md §2.2) - decoration over the rank number; see module comment. */
  readonly displayName: string;
  readonly idDigit: RankIdDigit;
  /** How many of this rank each side's full army includes. */
  readonly quantityPerSide: number;
}

/** The full rank catalog, keyed by rank. */
export const RANK_CATALOG: Readonly<Record<Rank, RankCatalogEntry>> = {
  5: {
    rank: 5,
    displayName: "Master-of-Arms",
    idDigit: "5",
    quantityPerSide: 3,
  },
  4: {
    rank: 4,
    displayName: "Champion",
    idDigit: "4",
    quantityPerSide: 3,
  },
  3: {
    rank: 3,
    displayName: "Foot Soldier",
    idDigit: "3",
    quantityPerSide: 3,
  },
  2: {
    rank: 2,
    displayName: "Militia",
    idDigit: "2",
    quantityPerSide: 3,
  },
  1: {
    rank: 1,
    displayName: "Peasant",
    idDigit: "1",
    quantityPerSide: 3,
  },
};

/** The rank catalog as a list, in `RANKS` order (strongest first). */
export function rankCatalogEntries(): RankCatalogEntry[] {
  return RANKS.map((rank) => RANK_CATALOG[rank]);
}

/** The Flag's id digit (rules.md §4.5, `start-position.md` §5) - it has no rank. */
export const FLAG_ID_DIGIT = "F";

/** The Flag's player-facing name. */
export const FLAG_DISPLAY_NAME = "Flag";

/** How many Flags each side's army includes - always exactly one. */
export const FLAG_QUANTITY_PER_SIDE = 1;

/** How many numbered pieces one full army holds: 3 of each of the 5 ranks. */
export const NUMBERED_PIECE_COUNT_PER_SIDE = RANKS.reduce(
  (total, rank) => total + RANK_CATALOG[rank].quantityPerSide,
  0,
);

/** How many pieces one full army holds in all: 15 numbered pieces plus 1 Flag (rules.md §2.2). */
export const ARMY_SIZE = NUMBERED_PIECE_COUNT_PER_SIDE + FLAG_QUANTITY_PER_SIDE;
