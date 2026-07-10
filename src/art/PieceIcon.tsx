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

import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import type { Side } from "../rules/primary/v1_1/board.ts";
import pieceSpriteSheet from "./pieceSprites.svg?raw";

/** Symbol id (in pieceSprites.svg) for each piece type. */
const SYMBOL_ID_BY_PIECE_TYPE: Readonly<Record<PieceTypeId, string>> = {
  lordMarshal: "p-marshal",
  champion: "p-champion",
  knight: "p-knight",
  infantry: "p-infantry",
  halberdier: "p-halberdier",
  militia: "p-militia",
  skirmisher: "p-skirmisher",
  archer: "p-archer",
  sapper: "p-sapper",
  assassin: "p-assassin",
  tower: "p-tower",
  flag: "p-flag",
};

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
function sideColor(side: Side): string {
  return side === "white" ? "var(--side-a)" : "var(--side-b)";
}

export interface PieceIconProps {
  readonly type: PieceTypeId;
  readonly side: Side;
  readonly className?: string;
}

/** Renders one piece's symbol, colored for the given side. */
export function PieceIcon({ type, side, className }: PieceIconProps) {
  const symbolId = SYMBOL_ID_BY_PIECE_TYPE[type];
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={{ color: sideColor(side) }}
      role="img"
      aria-hidden="true"
    >
      <use href={`#${symbolId}`} />
    </svg>
  );
}
