// Player-facing side naming (story 00000006 peer-review fix, Minor 4).
//
// Every Phase-2 UI/announcement module needs the same mapping from the
// internal turn-order side ("white"/"black" - never shown to a player) to
// the player-facing color it is called by ("Red"/"Blue"). This was
// previously redeclared as a private `sideColorName` in six modules
// (`PlacementStatus`, `PlayStatus`, `PlayBoard`, `playAnnouncement`,
// `playWarnings`, `DrawOffer`); this module is the one place it is defined,
// so the convention cannot drift between them. The side-flip helper
// (`otherSide`) has its own single home instead: `board.ts`, since it is a
// rule-layer concept (`play.ts`/`outcome.ts` need it too, not just the UI).
//
// Story 00000036, Step 11: takes the major-agnostic `ViewSide`
// (`src/board/view/viewModel.ts`) rather than major 2's own `Side` - a
// type-only change, since the two are structurally identical, so every
// existing call site (which passes a major-2 `Side`) is unaffected.

import type { ViewSide } from "./view/viewModel.ts";

/** Player-facing color name for a side. Never "White"/"Black" - those are internal-only. */
export function sideColorName(side: ViewSide): string {
  return side === "white" ? "Red" : "Blue";
}
