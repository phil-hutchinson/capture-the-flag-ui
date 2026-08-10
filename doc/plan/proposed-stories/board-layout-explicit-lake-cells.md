# Proposed story — Replace the lake-rows/lake-columns product with an explicit lake-cell set

**Status:** proposed (not yet a numbered story). Story numbers come from
GitHub and are chosen by the repository owner; do not assign one here or
create a numbered `doc/plan/NNNNNNNN-…` folder until it is picked up. This is
the follow-up to story 00000030 (Implement 10x10 board), specifically its peer
review finding #1, which the owner chose not to fix on that branch because it
is unreachable with any record this app or the companion project can write
today — see `doc/plan/00000030-implement-10x10-board/peer-review.md`.

## Motivation

`BoardLayout` (`src/rules/primary/v2/boardLayout.ts`) does not store a
board's lake squares directly. It stores two independent sets — `lakeRows`
(1-based row numbers) and `lakeColumnIndices` (0-based column indices) — and
`lakeCells` treats them as a **product**: every lake row crossed with every
lake column is a lake square. The field's own doc comment says as much:
`lakeColumnIndices` is "columns that carry a lake square on **every** lake
row." That is exactly right for all three of this app's catalog boards —
`standard_144`, `standard_64`, and `asymmetric_100` — because every one of
them happens to have an identical lake pattern repeated across all of its
lake rows (rules.md Appendix A; `asymmetric_100`'s own proposal explicitly
calls this out: "the lake pattern is identical in both lake rows"). A
rows-by-columns product is a lossless encoding of a lake pattern only when the
pattern is a perfect rectangle in exactly this sense.

Story 00000030 adds a second place this shape gets used:
`deriveBoardLayoutFromPositionBlock`
(`src/rules/primary/v2/gameState.ts`) builds a `BoardLayout` by reading a
record's own position block — rather than looking one up in the catalog —
for a record whose `Ruleset` tag names a `BOARD_LAYOUT` value this app has no
registered geometry for (Decisions 8 and 9: such a record must never be
rejected on that account, and must review on a board read straight off its
own text). The derivation collects every row that contains at least one
`XXX` cell into `lakeRows`, and every column that contains at least one `XXX`
cell into `lakeColumnIndices`, then hands both to the same product-based
`BoardLayout`.

**The failure this leaves open.** If an unknown board's lake squares are
_not_ a perfect rows-by-columns rectangle — for example, lakes at column A of
row 3 and column B of row 4 only, with no lake at A/4 or B/3 — the derivation
still produces `lakeRows = {3, 4}` and `lakeColumnIndices = {A, B}`, and the
resulting `BoardLayout`'s `lakeCells` therefore claims _four_ lake squares
(A3, B3, A4, B4) where the record's own block only drew two. The
`parsePositionBlock` pass that immediately follows then checks the block's
terrain against that invented geometry and **rejects the record** —
`lakeSquareNotXxx` at one of the two cells the derivation invented but the
block never marked. The app derived the very geometry it then complains the
record disagrees with, which is both a broken guarantee and a confusing
failure for a reviewer to hit.

That breaks two things this story's peer review flagged as absolute:

- Story 00000030's in-scope item 8 — "an unrecognized flag token is carried
  verbatim … and never rejects a record; only the edition id may reject one."
- Decision 9 (its implementation plan) — "no `FLAG=value` token ever rejects
  a record; the edition id is the only part of the `Ruleset` tag that can."

## Why this stays unfixed for now

Every board this app or the companion project's reference engine can
actually **write** today has a lake pattern that is a perfect rows-by-columns
product — all three catalog layouts repeat one identical pattern across every
lake row. There is no known-writable record whose position block would
trigger this failure; it is reachable only by hand-crafting a `Ruleset` tag
naming an unregistered `BOARD_LAYOUT` value alongside a hand-crafted,
non-rectangular position block (exactly how story 00000030's peer review
reproduced it — a synthetic 6x6 block tagged `BOARD_LAYOUT=weird_36` with
lakes at A3 and B4 only). Decision 9's guarantee therefore holds, in
practice, for every board any real record can name.

The owner judged that the correct fix is more invasive than this story's
scope allows: it means replacing `lakeRows`/`lakeColumnIndices` throughout
`BoardLayout` with an explicit lake-cell set, which is a change to a type
threaded through most of the ruleset core (`board.ts`, `movement.ts`,
`combat.ts`, `outcome.ts`, `placement.ts`, every catalog entry in
`boardLayout.ts`, and both derivation and rendering in `gameState.ts`) rather
than a one-function patch. That is this proposed story.

## Background & references

- Story 00000030 (`doc/plan/00000030-implement-10x10-board/`) — `story.md`
  for the Clash board/army work, `implementation-plan.md` for how
  `deriveBoardLayoutFromPositionBlock` was built (Step 8), and
  `peer-review.md` finding #1 for the exact reproduction and the owner's
  won't-fix reasoning.
- `src/rules/primary/v2/boardLayout.ts` — `BoardLayout`'s `lakeRows`/
  `lakeColumnIndices` fields and the `lakeCells` function that treats them as
  a product; `BOARD_LAYOUTS`, the catalog of the three known layouts, all of
  which happen to fit the product model exactly.
- `src/rules/primary/v2/gameState.ts` — `deriveBoardLayoutFromPositionBlock`,
  which builds a `BoardLayout` from an unknown record's own text, and
  `parsePositionBlock`, whose terrain check (`isLake` against every cell)
  is what rejects a record when the derived geometry and the block disagree.
- `doc/ruleset/technical-notes.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository — the view-only-replay guarantee this failure breaks ("for
  every record ever written, under any edition," "no rules knowledge
  required").

## Likely scope (to be firmed up when picked up)

- Replace `BoardLayout.lakeRows`/`lakeColumnIndices` with an explicit set of
  lake cells (e.g. a `readonly LakeCell[]` or an equivalent `(row,
columnIndex)` pair set), so `lakeCells`/`isLake` read off exactly the
  squares a layout names rather than a computed product.
- Update every catalog entry in `boardLayout.ts` (`standard_144`,
  `standard_64`, `asymmetric_100`) to state its lake cells explicitly. Their
  _rendered_ lake squares must not change by a single cell — this is a
  representation change, not a rules change, and every existing record
  fixture must still parse and replay identically.
- Update `deriveBoardLayoutFromPositionBlock` to carry the block's own `XXX`
  cells straight through as the lake-cell set, with no rows/columns
  intermediate step at all — the derivation becomes lossless for _any_ lake
  pattern, rectangular or not, closing the gap this proposal describes.
- Sweep every consumer of `lakeRows`/`lakeColumnIndices` (`board.ts`,
  `movement.ts`, `combat.ts`, `outcome.ts`, `placement.ts`, and any rendering
  or announcement code that reasons about "lake columns" as a concept, e.g.
  accessibility copy describing a lake edge) for an assumption that a lake
  pattern is uniform across its lake rows.
- Add a regression test proving a non-rectangular lake pattern on an unknown
  board reviews successfully end to end (the exact reproduction from peer
  review #1) — this is the story's primary acceptance criterion.
- Consider whether the explicit-cell representation should also become the
  _authoring_ format for a future board-editor or custom-layout capability
  (explicitly out of scope for story 00000030, and likely still out of scope
  here, but worth noting since the representation choice affects it).

## Dependencies / notes for the owner

- No known real record — from this app or the companion project's reference
  engine — currently exercises the failure this fixes, so there is no
  urgency tied to an existing user-visible bug; this is a correctness debt
  against a guarantee this app has stated, not a live defect report.
- Touches `src/rules/primary/v2/boardLayout.ts` and everything that reads
  `BoardLayout`'s lake fields — a wider diff than its single triggering
  function suggests, and worth a full pass rather than a narrow patch, given
  how many rule paths a `BoardLayout` threads through.
- If the companion project's proposal process ever produces a board whose
  lake pattern is _not_ uniform across its lake rows, this stops being
  purely theoretical and should be reprioritized.
