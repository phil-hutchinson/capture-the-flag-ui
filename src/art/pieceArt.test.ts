// Verifies story 00000036 Step 10's `(major, glyph)` piece-art re-keying: no
// visual change to major 2 (every piece type resolves to the same glyph and
// sprite it always has), major 3's own table matches the story's settled
// sprite mapping, and - the regression this step exists to guard against -
// every numeric glyph resolves to a *different* sprite in the two majors,
// with `F` the only one they agree on.
import { describe, expect, it } from "vitest";
import {
  pieceArtSpriteId,
  type Major2Glyph,
  type Major3Glyph,
} from "./pieceArt.ts";
import spriteSource from "./pieceSprites.svg?raw";
import {
  PIECE_CATALOG,
  PIECE_TYPES,
  type PieceTypeId,
} from "../rules/primary/v2/pieces.ts";
import { RANK_CATALOG, RANKS } from "../rules/primary/v3/pieces.ts";
import { pieceArtForType } from "../board/pieceArtByType.ts";
import { pieceArtForRankOrFlag } from "../board/pieceArtByRank.ts";

/** The Grounding facts' table (this story's implementation plan), restated as plain data for the test. */
const MAJOR_2_SPRITE_BY_GLYPH: Readonly<Record<Major2Glyph, string>> = {
  "1": "p-marshal",
  "2": "p-champion",
  "3": "p-knight",
  "4": "p-halberdier",
  "5": "p-infantry",
  "6": "p-militia",
  T: "p-tower",
  F: "p-flag",
};

const MAJOR_3_SPRITE_BY_GLYPH: Readonly<Record<Major3Glyph, string>> = {
  "1": "p-sapper",
  "2": "p-militia",
  "3": "p-infantry",
  "4": "p-champion",
  "5": "p-marshal",
  F: "p-flag",
};

describe("major 2's piece art (no visual change)", () => {
  it.each(PIECE_TYPES)(
    "%s resolves to its today's position-block symbol and sprite",
    (type: PieceTypeId) => {
      const art = pieceArtForType(type);
      expect(art.major).toBe(2);
      expect(art.glyph).toBe(PIECE_CATALOG[type].symbol);
      expect(pieceArtSpriteId(art)).toBe(
        MAJOR_2_SPRITE_BY_GLYPH[PIECE_CATALOG[type].symbol],
      );
    },
  );

  it("covers all 8 piece types", () => {
    expect(PIECE_TYPES).toHaveLength(8);
  });
});

describe("major 3's piece art", () => {
  it.each(RANKS)("rank %s resolves to the settled sprite", (rank) => {
    const art = pieceArtForRankOrFlag(rank);
    expect(art.major).toBe(3);
    expect(art.glyph).toBe(RANK_CATALOG[rank].idDigit);
    expect(pieceArtSpriteId(art)).toBe(
      MAJOR_3_SPRITE_BY_GLYPH[RANK_CATALOG[rank].idDigit],
    );
  });

  it("the Flag resolves to p-flag", () => {
    const art = pieceArtForRankOrFlag("flag");
    expect(art).toEqual({ major: 3, glyph: "F" });
    expect(pieceArtSpriteId(art)).toBe("p-flag");
  });

  it("covers all 5 ranks plus the Flag (6 pairs)", () => {
    expect(RANKS).toHaveLength(5);
  });
});

describe("the (major, glyph) key never collides", () => {
  const numericGlyphs: readonly ("1" | "2" | "3" | "4" | "5")[] = [
    "1",
    "2",
    "3",
    "4",
    "5",
  ];

  it.each(numericGlyphs)(
    "glyph %s resolves to a different sprite in each major",
    (glyph) => {
      expect(MAJOR_3_SPRITE_BY_GLYPH[glyph]).not.toBe(
        MAJOR_2_SPRITE_BY_GLYPH[glyph],
      );
    },
  );

  it("F is the only glyph the two majors agree on", () => {
    expect(MAJOR_2_SPRITE_BY_GLYPH.F).toBe(MAJOR_3_SPRITE_BY_GLYPH.F);
  });
});

describe("every referenced sprite id exists in pieceSprites.svg", () => {
  const referencedSpriteIds = new Set([
    ...Object.values(MAJOR_2_SPRITE_BY_GLYPH),
    ...Object.values(MAJOR_3_SPRITE_BY_GLYPH),
  ]);

  it.each([...referencedSpriteIds])("%s is defined as a <symbol>", (id) => {
    expect(spriteSource).toContain(`<symbol id="${id}"`);
  });
});
