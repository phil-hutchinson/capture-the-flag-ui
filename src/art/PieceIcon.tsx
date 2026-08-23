// Piece sprite rendering.
//
// The reusable symbol library lives in ./pieceSprites.svg (see that file's
// header comment for the re-tokenization rules). This module exposes:
//  - `PieceSpriteDefs`, which mounts that library's <defs> into the document
//    once (render it near the app root); and
//  - `PieceIcon`, a small component that draws one piece's symbol, colored
//    for its side, via `<use>` against the mounted defs.
//
// Terrain (the p-lake symbol) is not a piece type, so it is not drawn by
// PieceIcon; consumers reference it directly via `LAKE_SYMBOL_ID`.
//
// Story 00000036, Step 10: `PieceIcon` takes a `PieceArt` value (a major plus
// a glyph, see `./pieceArt.ts`) rather than a major-2 `PieceTypeId`, and
// imports nothing from `src/rules/` - two ruleset majors are live in this
// app, and a component keyed off one major's rule types could never draw the
// other's pieces. Callers holding a major-2 `PieceTypeId` go through
// `src/board/pieceArtByType.ts`'s adapter first.

import {
  pieceArtSpriteId,
  type PieceArt,
  type PieceArtSide,
} from "./pieceArt.ts";
import pieceSpriteSheet from "./pieceSprites.svg?raw";

/** Symbol id (in pieceSprites.svg) for the lake terrain sprite. */
export const LAKE_SYMBOL_ID = "p-lake";

/**
 * Mounts the piece + terrain symbol library into the document, hidden. Every
 * `PieceIcon` (and any direct `<use href="#p-lake">`) depends on this being
 * rendered somewhere in the page - render it once, near the app root.
 */
export function PieceSpriteDefs() {
  return (
    <div
      aria-hidden="true"
      style={{ display: "none" }}
      // The sprite sheet is a fixed, repo-owned asset (not user input), so
      // inlining its markup this way is safe.
      dangerouslySetInnerHTML={{ __html: pieceSpriteSheet }}
    />
  );
}

/** CSS color for a side, applied to a piece symbol via `color` (`currentColor`). */
function sideColor(side: PieceArtSide): string {
  return side === "white" ? "var(--side-a)" : "var(--side-b)";
}

export interface PieceIconProps {
  readonly art: PieceArt;
  readonly side: PieceArtSide;
  readonly className?: string;
}

/**
 * Renders one piece's symbol, colored for the given side, with the piece
 * art's own glyph (`1`-`6`, `T`, `F` at major 2; `1`-`5`, `F` at major 3)
 * pinned in the top-left corner as a quick rank reminder. The corner numeral
 * is separate overlay markup, not part of the `<symbol>`, so it is drawn here
 * alongside the `<use>`; `currentColor` makes it track the side color set on
 * the svg. Size/font (18px Times New Roman) match the tuned `class="badge"`
 * text in the prototype sample sheet `.local/ctf-tile-prototype.svg` — note
 * the sibling `.md` quotes stale values (32px/Georgia).
 */
export function PieceIcon({ art, side, className }: PieceIconProps) {
  const symbolId = pieceArtSpriteId(art);
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={{ color: sideColor(side) }}
      aria-hidden="true"
    >
      <use href={`#${symbolId}`} />
      <text
        x={15}
        y={17}
        fontSize={18}
        fontFamily="Times New Roman, serif"
        fontWeight={700}
        textAnchor="end"
        fill="currentColor"
      >
        {art.glyph}
      </text>
    </svg>
  );
}
