// The `(major, glyph)` piece-art key (story 00000036, Step 10).
//
// Two ruleset majors are live in this app at the same time, and they reuse
// piece *names* and *rank digits* at different strengths from each other:
// at major 2 rank 1 is the strongest piece, at major 3 rank 5 is, and "Foot
// Soldier" is rank 5 at major 2 but rank 3 at major 3 ("Militia" is 6 and 2).
// Artwork keyed off a name, or off a bare rank digit, is wrong in a way that
// produces a wrong board rather than an error - the companion project's own
// warning (see this story's implementation plan, "Grounding facts"). The fix
// is to key off the pair `(major, glyph)` - never a name, never a digit
// alone - with one lookup table per major, so the two can never collide even
// by accident.
//
// A `PieceArt` value names which major a piece belongs to and its one-
// character glyph in that major's own alphabet (`1`-`6`, `T`, `F` at major
// 2; `1`-`5`, `F` at major 3). The glyph doubles as the corner numeral
// `PieceIcon` draws, so a piece's rendered rank marker and its sprite lookup
// can never drift apart from each other.
//
// This module knows nothing about either ruleset major's rule types (no
// `PieceTypeId`, no `Rank`) - only the app-level tables its callers key by
// major and glyph. Each major's *own* adapter (`src/board/pieceArtByType.ts`
// for major 2; major 3's own adapter, added when a major-3 board exists) maps
// its own rule-layer piece identity into a `PieceArt` value.

/** A side, structurally identical to both majors' own `Side` types. Declared
 * fresh here, not imported from `src/rules/`, so this module (and
 * `PieceIcon`, which uses it) stays major-agnostic. */
export type PieceArtSide = "white" | "black";

/** Major 2's glyph alphabet - its position-block symbol (`rules.md` §2.2 / `pieces.ts`'s `PositionBlockSymbol`). */
export type Major2Glyph = "1" | "2" | "3" | "4" | "5" | "6" | "T" | "F";

/** Major 3's glyph alphabet - a rank's id digit (`reference/rules.md` §2.2 / v3's `RankIdDigit`), or the Flag. */
export type Major3Glyph = "1" | "2" | "3" | "4" | "5" | "F";

/**
 * A piece's art key: which major it belongs to, and its glyph in that
 * major's own alphabet. A discriminated union on `major`, so a major-2 value
 * can never be looked up against major 3's table (or vice versa) even by
 * mistake - the type system enforces the "never a shared key" rule, not just
 * the sprite tables below.
 */
export type PieceArt =
  | { readonly major: 2; readonly glyph: Major2Glyph }
  | { readonly major: 3; readonly glyph: Major3Glyph };

/**
 * Major 2's glyph -> sprite id table, unchanged from `PieceIcon`'s own
 * mapping before this step (`SYMBOL_ID_BY_PIECE_TYPE`, keyed by piece type
 * rather than glyph). `masterOfArms`/`footSoldier` keep their 1.1 sprites;
 * the retired ids' sprites (`p-skirmisher`, `p-archer`, `p-assassin`) stay in
 * the sprite sheet, unreferenced here; `p-sapper` is unreferenced by major 2
 * but used by major 3 below.
 */
const MAJOR_2_SPRITE_ID_BY_GLYPH: Readonly<Record<Major2Glyph, string>> = {
  "1": "p-marshal",
  "2": "p-champion",
  "3": "p-knight",
  "4": "p-halberdier",
  "5": "p-infantry",
  "6": "p-militia",
  T: "p-tower",
  F: "p-flag",
};

/**
 * Major 3's glyph -> sprite id table (owner decision, story.md "Design
 * decisions & constraints"). Ranks 2-5 reuse the sprite already drawn for
 * the major-2 piece *of the same name* - Master-of-Arms `p-marshal`,
 * Champion `p-champion`, Foot Soldier `p-infantry`, Militia `p-militia` -
 * because the artwork suits the name, even though for two of them (Foot
 * Soldier, Militia) the *glyph* differs from major 2's. Rank 1, the Peasant,
 * uses `p-sapper`, one of the sheet's unreferenced major-1 sprites: it draws
 * a spade, which reads as well for a peasant as for a sapper. Sharing a
 * drawing this way is fine; sharing a *lookup key* is exactly the mistake
 * this module's separate tables prevent - every numeric glyph below resolves
 * to a different sprite than major 2's table above; only `F` agrees.
 * `p-knight`, `p-halberdier` and `p-tower` are not used at major 3.
 */
const MAJOR_3_SPRITE_ID_BY_GLYPH: Readonly<Record<Major3Glyph, string>> = {
  "1": "p-sapper",
  "2": "p-militia",
  "3": "p-infantry",
  "4": "p-champion",
  "5": "p-marshal",
  F: "p-flag",
};

/** Resolves a `PieceArt` value to the sprite id (in `pieceSprites.svg`) it draws. */
export function pieceArtSpriteId(art: PieceArt): string {
  return art.major === 2
    ? MAJOR_2_SPRITE_ID_BY_GLYPH[art.glyph]
    : MAJOR_3_SPRITE_ID_BY_GLYPH[art.glyph];
}
