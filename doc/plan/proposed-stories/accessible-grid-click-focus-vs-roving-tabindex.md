# Proposed story — Accessible grid: reconcile real DOM focus with roving tabindex on non-actionable cells

**Status:** proposed (not yet a numbered story). Story numbers come from GitHub
and are chosen by the repository owner; do not assign one here or create a
numbered `doc/plan/NNNNNNNN-…` folder until it is picked up.

## The wrinkle

`src/board/grid/AccessibleGrid.tsx` implements the WAI-ARIA roving-tabindex
pattern: exactly one `role="gridcell"` carries `tabIndex={0}` (the grid's own
"focused" state) at a time, and every other focusable cell carries
`tabIndex={-1}`. A cell that is `focusable: true` but `actionable: false`
still carries `tabIndex={-1}` and therefore remains a valid **click** target
for real DOM focus, even though it is wired with no `onClick` handler of its
own for activation purposes — the browser still lets a mouse click move real
focus to any element with a `tabIndex`.

Consequence: clicking a non-actionable-but-focusable cell (e.g. a buffer or
lake-row square in placement's partial board view, story 00000002) moves real
DOM focus onto that cell, but the grid's own `focused` roving-tabindex state
(the position an arrow key moves _from_) does not follow it — nothing in
`AccessibleGrid` listens for a plain click on a non-actionable cell to update
`focused`. The next arrow key then computes its next position from the
_stale_ `focused` value, not from where DOM focus visually is, so focus
appears to jump back to wherever it was before the click.

`src/board/Board.css`'s `pointer-events: none` sits on the cell's _inner
content_ rather than the `role="gridcell"` wrapper itself (needed so the
wrapper can still take keyboard focus at all), which is what makes a
non-actionable cell reachable by a mouse click in the first place.

## Scope

- Affects any `AccessibleGrid` consumer with focusable-but-non-actionable
  cells — today that is placement's buffer/lake-row bands (story 00000002)
  and, in principle, any future Phase-2 (`FullBoard`/`PlayBoard`) or review
  view that marks a cell focusable without making it actionable.
- Fix belongs in the shared grid (`AccessibleGrid.tsx`) — e.g. syncing
  `focused` to a clicked cell's position even when it is not actionable — not
  in any one consumer, since the wrinkle is a property of the roving-tabindex
  implementation itself, not of placement's board specifically.
- Pre-dates story 00000002: the same shape of interaction was already
  possible wherever a non-actionable-but-focusable cell existed before this
  story (see story 00000002's peer review, finding #13, which first wrote
  this down against placement's now much larger non-interactive band).

## Dependencies / constraints

- Out of scope for story 00000002 under that story's decision 5: the shared
  grid may take only additive, default-preserving changes there, and this fix
  is a behavioural change to existing click handling.
