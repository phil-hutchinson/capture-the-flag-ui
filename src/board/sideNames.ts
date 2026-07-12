// Player-facing side naming (story 00000006 peer-review fix, Minor 4).
//
// Every Phase-2 UI/announcement module needs the same mapping from the
// internal turn-order `Side` (`board.ts`'s "white"/"black" - never shown to
// a player) to the player-facing color it is called by ("Red"/"Blue"). This
// was previously redeclared as a private `sideColorName` in six modules
// (`PlacementStatus`, `PlayStatus`, `PlayBoard`, `playAnnouncement`,
// `playWarnings`, `DrawOffer`); this module is the one place it is defined,
// so the convention cannot drift between them. The side-flip helper
// (`otherSide`) has its own single home instead: `board.ts`, since it is a
// rule-layer concept (`play.ts`/`outcome.ts` need it too, not just the UI).

import type { Side } from "../rules/primary/v1_1/board.ts";

/** Player-facing color name for a side. Never "White"/"Black" - those are internal-only. */
export function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
}
