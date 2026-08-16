// Major 2's piece-art adapter (story 00000036, Step 10).
//
// `PieceIcon` no longer knows about major 2's `PieceTypeId` (see
// `src/art/pieceArt.ts`); this module is the one place that turns a major-2
// piece type into a `PieceArt` value, for the callers that still hold one -
// `FullBoard.tsx`, `Board.tsx`, `Tray.tsx`, `PlacementControls.tsx`, and
// `src/app/rules/RuleFigure.tsx`. It lives in `src/board/`, not in
// `src/rules/`: the rules layer has no business knowing about artwork, and
// this adapter is above the "meets both majors" seam, not inside either
// major's rule engine.
//
// The mapping is an exhaustive `Record<PieceTypeId, Major2Glyph>` - listing
// every piece type by name, rather than deriving it from `PIECE_CATALOG` -
// so that a new major-2 piece type fails to compile here rather than
// silently falling into a default. Every value below equals that type's own
// `PIECE_CATALOG[...].symbol` (the position-block symbol it has always
// rendered as its corner numeral); `pieceArt.test.ts` asserts the two never
// drift apart.

import type { PieceTypeId } from "../rules/primary/v2/pieces.ts";
import { type Major2Glyph, type PieceArt } from "../art/pieceArt.ts";

const MAJOR_2_GLYPH_BY_PIECE_TYPE: Readonly<Record<PieceTypeId, Major2Glyph>> =
  {
    masterOfArms: "1",
    champion: "2",
    knight: "3",
    halberdier: "4",
    footSoldier: "5",
    militia: "6",
    tower: "T",
    flag: "F",
  };

/** The `PieceArt` value for a major-2 piece type - see module comment. */
export function pieceArtForType(type: PieceTypeId): PieceArt {
  return { major: 2, glyph: MAJOR_2_GLYPH_BY_PIECE_TYPE[type] };
}
