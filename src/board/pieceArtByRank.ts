// Major 3's piece-art adapter (story 00000036, Step 10).
//
// The sibling of `pieceArtByType.ts`: turns a major-3 piece identity (a
// numbered piece's `Rank`, or the Flag) into a `PieceArt` value. Nothing
// consumes this yet - the major-3 board adapter itself is Step 14's work -
// but it is added here, alongside Step 10's re-keying of `PieceIcon`, so the
// full `(major, glyph)` table this story's plan calls for exists and is
// tested from the start, per the plan's "wherever it lives it must be
// exhaustive over the five ranks plus the Flag."
//
// The mapping is an exhaustive `Record<Rank | "flag", Major3Glyph>` - so a
// new rank fails to compile here rather than silently falling into a
// default. Every numbered rank's glyph equals its own `RankIdDigit`
// (`RANK_CATALOG[rank].idDigit`, `src/rules/primary/v3/pieces.ts`) as a
// string; `pieceArt.test.ts` asserts the two never drift apart.

import type { Rank } from "../rules/primary/v3/pieces.ts";
import { type Major3Glyph, type PieceArt } from "../art/pieceArt.ts";

/** A major-3 piece identity: a numbered piece's rank, or the Flag. */
export type Major3PieceKind = Rank | "flag";

const MAJOR_3_GLYPH_BY_PIECE_KIND: Readonly<
  Record<Major3PieceKind, Major3Glyph>
> = {
  5: "5",
  4: "4",
  3: "3",
  2: "2",
  1: "1",
  flag: "F",
};

/** The `PieceArt` value for a major-3 piece (a rank, or the Flag) - see module comment. */
export function pieceArtForRankOrFlag(kind: Major3PieceKind): PieceArt {
  return { major: 3, glyph: MAJOR_3_GLYPH_BY_PIECE_KIND[kind] };
}
