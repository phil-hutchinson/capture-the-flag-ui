// Piece catalog & army inventory for ruleset PRIMARY:1.1.
//
// Per-type counts, rank codes, and position-block symbols per rules.md §2.2
// (companion capture-the-flag repository, the single source of truth),
// unchanged since v1.0 per the changelog. Sum of quantities is 48 (one full
// army per side). See doc/plan/00000001-create-board-layout-tool/
// implementation-plan.md "Grounding facts" for the source table.
//
// This module has no knowledge of the board or of placement - it is pure
// piece data - so it has no dependencies elsewhere in the ruleset core.

/** Stable identifier for one of the 12 piece types. */
export type PieceTypeId =
  | "lordMarshal"
  | "champion"
  | "knight"
  | "infantry"
  | "halberdier"
  | "militia"
  | "skirmisher"
  | "archer"
  | "sapper"
  | "assassin"
  | "tower"
  | "flag";

/**
 * A piece's rank, used for Phase 2 combat comparisons: 1-9 for the ranked
 * combat pieces, `"special"` for the Assassin (whose combat rules are not
 * rank-vs-rank), or `null` for Tower and Flag, which have no rank at all.
 */
export type RankCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "special" | null;

/**
 * The single character used to render this piece type in the position-block
 * serialization (see technical-notes.md's "Record file format"). Every
 * piece type has a distinct symbol.
 */
export type PositionBlockSymbol =
  "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "A" | "T" | "F";

export interface PieceCatalogEntry {
  readonly id: PieceTypeId;
  /** Player-facing name, shown in the tray (uses "move" vocabulary rules do not apply - this is a noun, not a verb). */
  readonly displayName: string;
  readonly rankCode: RankCode;
  readonly symbol: PositionBlockSymbol;
  /** How many of this type each side's full army includes. */
  readonly quantityPerSide: number;
}

/** All 12 piece type ids, in the order they're listed in the ruleset. */
export const PIECE_TYPES: readonly PieceTypeId[] = [
  "lordMarshal",
  "champion",
  "knight",
  "infantry",
  "halberdier",
  "militia",
  "skirmisher",
  "archer",
  "sapper",
  "assassin",
  "tower",
  "flag",
];

/** The full piece catalog, keyed by piece type id. */
export const PIECE_CATALOG: Readonly<Record<PieceTypeId, PieceCatalogEntry>> = {
  lordMarshal: {
    id: "lordMarshal",
    displayName: "Lord Marshal",
    rankCode: 1,
    symbol: "1",
    quantityPerSide: 1,
  },
  champion: {
    id: "champion",
    displayName: "Champion",
    rankCode: 2,
    symbol: "2",
    quantityPerSide: 2,
  },
  knight: {
    id: "knight",
    displayName: "Knight",
    rankCode: 3,
    symbol: "3",
    quantityPerSide: 4,
  },
  infantry: {
    id: "infantry",
    displayName: "Infantry",
    rankCode: 4,
    symbol: "4",
    quantityPerSide: 4,
  },
  halberdier: {
    id: "halberdier",
    displayName: "Halberdier",
    rankCode: 5,
    symbol: "5",
    quantityPerSide: 6,
  },
  militia: {
    id: "militia",
    displayName: "Militia",
    rankCode: 6,
    symbol: "6",
    quantityPerSide: 6,
  },
  skirmisher: {
    id: "skirmisher",
    displayName: "Skirmisher",
    rankCode: 7,
    symbol: "7",
    quantityPerSide: 6,
  },
  archer: {
    id: "archer",
    displayName: "Archer",
    rankCode: 8,
    symbol: "8",
    quantityPerSide: 3,
  },
  sapper: {
    id: "sapper",
    displayName: "Sapper",
    rankCode: 9,
    symbol: "9",
    quantityPerSide: 8,
  },
  assassin: {
    id: "assassin",
    displayName: "Assassin",
    rankCode: "special",
    symbol: "A",
    quantityPerSide: 1,
  },
  tower: {
    id: "tower",
    displayName: "Tower",
    rankCode: null,
    symbol: "T",
    quantityPerSide: 6,
  },
  flag: {
    id: "flag",
    displayName: "Flag",
    rankCode: null,
    symbol: "F",
    quantityPerSide: 1,
  },
};

/** The full piece catalog as a list, in `PIECE_TYPES` order. */
export function pieceCatalogEntries(): PieceCatalogEntry[] {
  return PIECE_TYPES.map((id) => PIECE_CATALOG[id]);
}

/** Total number of pieces in one full army (sum of every type's quantity). */
export const ARMY_SIZE: number = pieceCatalogEntries().reduce(
  (total, entry) => total + entry.quantityPerSide,
  0,
);

/** Remaining-count-per-type. Used by the placement-state model (Step 3). */
export type Inventory = Readonly<Record<PieceTypeId, number>>;

/** A fresh, full 48-piece army inventory: every type at its full quantity. */
export function freshInventory(): Inventory {
  const inventory = {} as Record<PieceTypeId, number>;
  for (const id of PIECE_TYPES) {
    inventory[id] = PIECE_CATALOG[id].quantityPerSide;
  }
  return inventory;
}
