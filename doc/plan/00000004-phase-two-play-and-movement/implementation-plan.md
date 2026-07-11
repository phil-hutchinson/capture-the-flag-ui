# Implementation Plan — Story 00000004: Phase 2 play (board, movement & turn alternation)

This plan implements the first slice of Phase 2: revealing both armies on one
board and letting players take strictly-alternating turns moving a piece onto an
empty square it can legally reach. **No attacks, no capture, no game-end** — those
are stories 00000005 and 00000006.

Read `story.md` in this folder first. This plan assumes the reader has read only
`story.md`, this plan, and their own step — every fact a step needs is stated in
the plan.

---

## Grounding facts (confirmed at plan time)

**Ruleset (re-confirmed against the companion `capture-the-flag` repository's
`doc/ruleset/rules.md`, single source of truth, at version 1.1 — the version this
repo already targets, `RULESET_TAG = "PRIMARY:1.1"`):**

- Phase 2 play **strictly alternates**, one move per player; **passing is never
  allowed** (§4.1). A player with no legal move loses — but that is story
  00000006; see "stuck" note below.
- **Baseline movement** (§4.2): a piece steps **one square orthogonally** (up,
  down, left, right — never diagonally), into an empty square. No piece may enter
  or pass through a **lake**, nor move onto a square occupied by any piece.
- **Skirmisher** (§4.2 "rush"): may move **up to 3 squares in a straight line**
  for plain movement, requiring a **clear straight line** — every intermediate
  square empty of pieces and lakes; the destination also empty.
- **Knight** (§4.2 "charge"): a Knight moving **without attacking is limited to
  one square**. Its 2–3 square charge exists **only as an attack**, so it is out
  of scope here (story 00000005). In this story a Knight moves exactly like the
  baseline.
- **Towers and the Flag never move** (§4.2, §2.2).
- **Every other piece type** — Lord Marshal, Champion, Infantry, Halberdier,
  Militia, Archer, Sapper, Assassin — moves the **standard one square
  orthogonally**, with no movement quirk (confirmed: only the Skirmisher's range
  and the Knight/Tower/Flag exceptions above alter baseline movement).
- **Empty-square moves only in this story.** Because attacks are out of scope, a
  square occupied by *any* piece (friendly or enemy) is not a legal destination.
- **Move notation** (§4.4): a move is written as its **source square immediately
  followed by its destination square, no separator** — e.g. `A2A3`. Square names
  use the **absolute White frame**: columns A–L left-to-right, rows 1–12 where row
  1 is White's back rank and row 12 is Black's back rank. This absolute frame is
  independent of which player's on-screen perspective the board is shown from.

**Repository facts to build on (delivered by story 00000001; reuse, do not
rebuild):**

- `src/rules/primary/v1_1/board.ts` — board geometry: `Column`, `Row`, `Side`
  (`"white" | "black"`), `Square`, `squareKey`, `allSquares`, `isLake`,
  `regionOf`, `COLUMNS`, `ROWS`.
- `src/rules/primary/v1_1/pieces.ts` — `PieceTypeId`, `PIECE_CATALOG` (per-type
  `displayName`, `rankCode`, `symbol`, `quantityPerSide`).
- `src/rules/primary/v1_1/gameState.ts` — `RULESET_TAG` (`"PRIMARY:1.1"`),
  `PlacedPiece` (`{ side, pieceType }`), `BoardState` (a JSON-serializable
  `Readonly<Record<string, PlacedPiece>>` keyed by absolute `squareKey`),
  `InitialGameState` (`{ ruleset, board }`), `buildInitialGameState`,
  `renderPositionBlock` (renders a `BoardState`-bearing state as the 12×12
  position-block text in the absolute White frame).
- `src/board/boardView.ts` — pure screen-orientation geometry. Today it exposes
  `visibleRows(side)` / `visibleColumns(side)` for the **cropped placement view**
  (only the active player's home rows plus the nearest buffer/lake row). White is
  un-rotated (columns A→L, row 1 nearest the player); Black is a 180° rotation
  (columns L→A, row 12 nearest the player).
- `src/board/Board.tsx` + `Board.css` — the **placement** board renderer. It is
  cropped to one player's half and is **mouse-only** (`onClick`, no keyboard/ARIA).
  This story does **not** retrofit it; see the Phase-2 board decision below.
- `src/art/PieceIcon.tsx` — `PieceIcon` (draws one piece colored for its side via
  `--side-a`/`--side-b`) and `PieceSpriteDefs` (mount once near the app root).
  `LAKE_SYMBOL_ID` renders the lake sprite.
- `src/board/placementSession.ts` + `src/board/PlacementStatus.tsx` — the Phase-1
  hot-seat flow. `PlacementStatus.tsx` establishes the **player-facing color
  convention**: side `"white"` → **"Red"**, side `"black"` → **"Blue"** (never the
  internal "White"/"Black" labels), and the vocabulary rule **"move" not "ply"** in
  player-facing text. Reuse this convention for the Phase-2 turn indicator.
- `src/App.tsx` — drives the app. Today, once both players confirm
  (`session.active === null`) it renders `SessionComplete` (the neutral "both
  armies ready" terminal state, which builds and surfaces the `InitialGameState`
  artifact but reveals neither layout). This story extends App to transition from
  that terminal state into Phase 2.

**Testing conventions:** the project uses **Vitest** with a **`node`** test
environment (see `vite.config.ts`) — there is **no jsdom, no DOM/component testing
library**, and all existing tests are pure unit tests colocated as `*.test.ts`
next to their module. This plan follows that: **rule logic, state machines, and
orientation/navigation math are covered by automated pure-unit tests; React
component, ARIA, keyboard, and screen-reader behavior are covered by the story's
manual gates.** Do not add a component-testing stack for this story.

**Key architecture decisions (settled here so each step can assume them):**

- **New Phase-2 board component, not a refactor of `Board.tsx`.** The Phase-1
  `Board` is cropped to one half and mouse-only; Phase 2 needs the full 12×12
  board and a keyboard-operable, screen-reader-perceivable grid. Building a
  separate Phase-2 board component (reusing `PieceIcon`, the side colors, the
  board geometry, and the orientation helpers) is cleaner than overloading the
  placement board. "Reuse, don't rebuild" is satisfied by reusing those
  primitives, not by forcing both phases through one component.
- **Accessibility is built as a reusable grid interaction model.** Story 00000002
  (accessible Phase-1 placement) has **not** been implemented — only its
  `story.md` exists. Therefore the shared accessible grid (WAI-ARIA `grid` roles,
  roving `tabindex`, arrow-key navigation, Enter/Space to act, live-region
  announcements) referenced in the story as "the pattern story 00000002
  establishes" must be **built in this story**, designed generically so 00000002
  can later adopt it for placement without a rewrite. Do not assume any
  accessibility groundwork already exists.
- **Movement rule logic is versioned**, added under `src/rules/primary/v1_1/`
  alongside the existing `board.ts`/`pieces.ts`/`gameState.ts`, consistent with
  story 00000001. Recorded moves are tagged with (or derived under) `RULESET_TAG`.
- **"Stuck with no legal move" is an accepted rough edge here.** Because attacks
  are out of scope, a player might have no legal empty-square move. Handle it
  quietly (never crash); do **not** add special UI or automated tests for it — the
  real "no legal move" handling is story 00000006.
- **Illegal destinations are prevented structurally**, mirroring Phase 1: the UI
  only ever offers legal squares as actionable targets; the rule/state layer
  additionally treats an illegal move as a programming-invariant violation
  (throws), matching the existing placement module's throw-on-invariant style.

---

## Step 1 — Movement rule logic: legal empty-square destinations

Status: committed

Notes: Added `src/rules/primary/v1_1/movement.ts` exporting `legalDestinations(board, origin)`
(baseline pieces: 1 orthogonal square each direction; Skirmisher: up to 3 in a
clear straight line, stopped by the first lake/occupied square without
including it as a destination; Tower/Flag: none; Knight moves like baseline
per this story's scope) and `hasAnyLegalMove(board, side)`. Added colocated
`movement.test.ts` covering every case in the verification list (baseline
orthogonal empties, corner/edge pruning, adjacent-lake exclusion,
friendly/enemy occupied exclusion, Tower/Flag immobility, empty-origin,
no-diagonal, Skirmisher full 3-square reach, lake cutoff, piece cutoff at
distances 1/2/3) plus two light sanity tests for `hasAnyLegalMove`'s
true/false cases (not the "stuck" scenario, which per the plan is
intentionally untested). No deviations from the plan.

Add a new versioned module `src/rules/primary/v1_1/movement.ts` (pure, no React)
that, given a `BoardState` (from `gameState.ts`) and an origin `Square`, computes
the set of squares that the piece on that origin may legally move to **onto an
empty square**, per the confirmed movement rules:

- If the origin is empty, or holds a Tower or Flag, there are **no** destinations.
- Skirmisher: up to **3 squares** along each of the four orthogonal directions,
  stopping the ray as soon as it hits a lake or any occupied square (the blocker
  square itself is not a destination in this story); every square passed through
  and the destination must be empty and not a lake.
- Every other movable piece type: the **one** orthogonally-adjacent square in each
  direction, if it is on-board, not a lake, and empty.
- Never diagonal; never off-board.

Expose a function that returns the legal destination squares for a given origin,
and a small helper the later state layer can use to ask "does this side's board
have **any** legal move?" (used only to fail quietly for the accepted "stuck"
case — see Grounding facts — not for UI or tests of that case). Keep everything
keyed in the **absolute White frame** (`squareKey`); this module knows nothing
about screen orientation.

Depends on: nothing new — builds only on story 00000001's `board.ts`, `pieces.ts`,
and `BoardState` from `gameState.ts`.

Verification (automated): Add `src/rules/primary/v1_1/movement.test.ts` and run
`npm test`. Cover, on hand-built `BoardState` fixtures: a baseline piece's four
orthogonal empties; edges/corners (off-board pruned); a lake adjacent (excluded);
an occupied adjacent square — friendly and enemy — excluded (empty-only);
Skirmisher reaching 1/2/3 squares in a clear line and being cut short by a lake
and by an occupying piece; a Skirmisher's blocked ray yielding no square past the
blocker; Tower and Flag yielding no destinations; and no diagonal ever appearing.

---

## Step 2 — Phase 2 game-state model and move application

Status: committed

Notes: Added `src/rules/primary/v1_1/play.ts` exporting `PlayState`
(`ruleset`, `board`, `sideToMove`, `moves: readonly string[]`), `startPlay`
(White to move first, board/ruleset carried from the `InitialGameState`,
empty move list), and `applyMove` (immutable-style, mirrors `placement.ts`'s
throw-on-invariant style: throws if `from` isn't the side-to-move's own
piece, or if `to` isn't among `legalDestinations(state.board, from)` from
Step 1; otherwise returns a new `PlayState` with the piece moved, the side
flipped, and the move appended as `squareKey(from) + squareKey(to)`). Added
colocated `play.test.ts` covering `startPlay` correctness, `applyMove`
moving/flipping/appending, a multi-move alternating sequence, non-mutation
of the input state, and throws for a wrong-side piece, an empty origin, an
out-of-range destination, and an occupied destination. No deviations from
the plan.

Add a new versioned module `src/rules/primary/v1_1/play.ts` (pure, no React) that
models an in-progress Phase-2 game and applies moves. Define a `PlayState`
type carrying at minimum: the `ruleset` tag (from `RULESET_TAG`), the current
`BoardState`, the `Side` to move, and the ordered list of moves made so far in
`A2A3` coordinate string form (absolute White frame). Provide:

- A `startPlay(initial: InitialGameState)` that produces the opening `PlayState`
  from story 00000001's artifact: same board, **White (Red) to move first**, empty
  move list, ruleset carried over from the artifact.
- An `applyMove(state, from, to)` that returns a **new** `PlayState` (immutable
  style, like the placement module): the piece moves from `from` to `to` on the
  board, the side-to-move flips, and the move is appended as its coordinate string
  (`squareKey(from) + squareKey(to)`, e.g. `"A2A3"`). It **asserts legality**
  (throws) if the moved piece is not the side-to-move's own piece, or if `to` is
  not among Step 1's legal destinations for `from` — consistent with the existing
  throw-on-invariant convention (the UI never offers an illegal move, so this is a
  programming-invariant guard, not a user-facing error).

Do not add any special handling or state for the "stuck with no legal move" case
beyond not crashing (Step 1's helper exists if a caller wants to detect it).

Depends on: Step 1 (legal-destination check reused by `applyMove`) and story
00000001's `gameState.ts` (`InitialGameState`, `BoardState`, `RULESET_TAG`).

Verification (automated): Add `src/rules/primary/v1_1/play.test.ts` and run
`npm test`. Confirm: `startPlay` yields White to move, board equal to the initial
board, empty move list, correct ruleset; `applyMove` moves the piece (origin now
empty, destination now holds it), flips the side, and appends the right `A2A3`
string; a sequence of moves accumulates in order and alternates sides; the input
state is never mutated; and `applyMove` throws for a wrong-side piece and for a
destination that is not legal (e.g. two squares for a baseline piece, or onto an
occupied square).

---

## Step 3 — Replay-anticipating game-record rendering

Status: committed

Notes: Confirmed the "Record file format" against the companion repository's
live `doc/ruleset/technical-notes.md` (fetched via raw.githubusercontent.com):
header tags use PGN `[Name "value"]` syntax, the position block is always the
*starting* position, and the move sequence is `N. WhiteMove BlackMove` rounds
numbered from 1 with a trailing White-only round when the game ends on
White's move — exactly as the plan describes. Deviation: `PlayState` (Step 2)
did not retain the starting board needed for the position block, so extended
it with a new `initialBoard: BoardState` field (set once in `startPlay`,
carried through unchanged by `applyMove`, which only touches `board`) — this
is additive/backward-compatible, so Step 2's existing assertions still pass;
added a couple of new assertions to `play.test.ts` (`startPlay` sets
`initialBoard`; a move sequence leaves `initialBoard` equal to the opening
board while `board` diverges) rather than rewriting Step 2's tests. Added
`renderGameRecord(state: PlayState): string` to `play.ts`, emitting `[Ruleset
"PRIMARY:1.1"]`, then `renderPositionBlock` of `state.initialBoard`, then the
round-grouped move sequence, each section separated by a blank line. Added a
`describe("renderGameRecord", ...)` block to `play.test.ts` covering the
Ruleset tag, the opening-position block (verified it does *not* equal the
current board's block after moves), and round numbering including the
trailing White-only round. No other deviations.

Add a function (in `play.ts`, or a small sibling it imports) that renders a
`PlayState` into an inspectable, developer-facing text form that **anticipates the
recorded-game replay file format** without implementing replay. The format, per
the companion repository's `doc/ruleset/technical-notes.md` "Record file format",
has: the `Ruleset` tag (`PRIMARY:1.1`); the **position block** for the *starting*
board (reuse `renderPositionBlock` from `gameState.ts`, feeding it the opening
board); and a **move sequence** grouped into rounds numbered from 1, each round
`N. <whiteMove> <blackMove>` (a final round with only White's move shows just that
one). Moves appear in the plain `A2A3` form (no separators, no combat markers —
there is no combat in this story).

This is the minimum a future replay story can build on; keep it a plain string
render (the UI wiring that surfaces it is Step 10). White moves occupy the
odd positions in the move list and Black the even, so the round grouping is
derivable from the move list order.

Depends on: Step 2 (`PlayState` and its move list) and story 00000001's
`renderPositionBlock`.

Verification (automated): Extend `play.test.ts` (or add a colocated test) and run
`npm test`. On a `PlayState` built from a known initial position with a few moves
applied, assert the rendered text contains the `Ruleset` tag, a position block
matching `renderPositionBlock` of the opening board, and a move sequence with
correct round numbers and `A2A3` moves (including the trailing White-only round
when the last move was White's).

---

## Step 4 — Full-board screen-orientation geometry

Status: committed

Notes: Added `fullBoardRows(side)` to `src/board/boardView.ts`, returning the
full 12-row order (White: 12...1 top-to-bottom; Black: 1...12), reusing
`ROWS` from `board.ts`; left `visibleRows`/`visibleColumns` untouched. A
Phase-2 renderer pairs `fullBoardRows(side)` with the existing
`visibleColumns(side)` to draw all 144 squares oriented per side. Added
tests to `src/board/boardView.test.ts` covering the row order for each side,
that every row appears exactly once, that combining with `visibleColumns`
covers all 144 unique squares per side, and column order per side. No
deviations from the plan.

Extend `src/board/boardView.ts` (pure, no React) with the **full 12×12**
orientation for Phase 2, alongside the existing cropped `visibleRows` /
`visibleColumns` (leave those untouched — placement still uses them). Add a
function giving the full board's rows in top-to-bottom **screen** order for a
given `Side`, such that the active player's own home edge is **nearest them (at
the bottom)**:

- White (Red): rows 12 (top) → 1 (bottom), so row 1 (White's back rank) is
  nearest. Columns A→L left-to-right (reuse `visibleColumns("white")`).
- Black (Blue): a 180° rotation — rows 1 (top) → 12 (bottom), so row 12 (Black's
  back rank) is nearest. Columns L→A (reuse `visibleColumns("black")`).

The result must let the Phase-2 board render all 144 squares oriented to whichever
side is to move, and flip when the side flips. This module stays pure geometry —
it knows nothing about pieces, movement, or React.

Depends on: story 00000001's `boardView.ts` and `board.ts`. No dependency on
Steps 1–3.

Verification (automated): Add to (or create) `src/board/boardView.test.ts` and
run `npm test`. Assert the full-board row order for White is `12…1` top-to-bottom
and for Black is `1…12`; that every one of the 144 squares appears exactly once;
and that column order matches `visibleColumns` per side (A→L for White, L→A for
Black).

---

## Step 5 — Reusable accessible grid interaction model

Status: pending

Notes:

Build a generic, **piece-agnostic** accessible grid under `src/board/grid/` that
Phase 2 will render the board through and that story 00000002 can later adopt for
Phase-1 placement. It provides the WAI-ARIA composite-widget behavior the story
requires: a container with `role="grid"`, rows with `role="row"`, cells with
`role="gridcell"`; **roving `tabindex`** (exactly one cell tabbable at a time, the
rest `-1`); **arrow-key navigation** (Up/Down/Left/Right move focus one cell in
screen space, clamped at edges — no wraparound and never trapped); **Enter/Space**
to activate the focused cell; and a **polite ARIA live region** the consumer can
push short announcement strings into. The component takes as input a 2-D array of
cell descriptors (each with its rendered content, an accessible label, and flags
for whether it is focusable/actionable) plus an activation callback keyed by cell
position; it does **not** know about pieces, sides, movement, or orientation.

Separate the **navigation math** into a pure function (given grid dimensions, the
current focused position, an arrow key, and which cells are focusable → the next
focused position) so it can be unit-tested in the `node` environment. The React
component consumes that pure function and wires the ARIA roles, roving tabindex,
focus management, and live region; its full keyboard/screen-reader behavior is
verified in Gate D (Step 9), since the repo has no DOM test environment.

Keep visible focus styling in a colocated CSS file (a clearly visible focus ring
on the focused cell) so "focus is always visible" (Gate D) is satisfiable.

Depends on: nothing in Steps 1–4 (it is generic infrastructure). Comes before the
Phase-2 board (Step 7) that renders through it.

Verification (automated): Add a colocated `*.test.ts` for the pure navigation
function and run `npm test`. Cover: each arrow moves focus one cell in the right
direction; focus clamps (does not wrap) at every edge; and navigation skips to /
stops correctly given a focusable mask (whatever skip policy the function
defines). (The ARIA/keyboard/live-region behavior of the React component is
verified manually in Gate D, Step 9 — note this explicitly in the step's Notes
when implemented.)

---

## Step 6 — Phase 2 interaction and turn state machine

Status: pending

Notes:

Add a pure module (e.g. `src/board/playSession.ts`, no React) that owns the
Phase-2 turn-and-selection state machine, sitting between the rule layer (Steps
1–2) and the UI (Step 7). It holds the current `PlayState` (Step 2) plus the
active player's current selection (which of their own pieces, if any, is picked
up), and exposes intent-level operations the UI calls when a board cell is
activated:

- Activating one of the **side-to-move's own movable pieces**: selects it (picks
  it up). Its legal destinations (Step 1) become the highlighted, actionable
  targets. Activating the same piece again deselects it.
- Activating a **legal destination** while a piece is selected: applies the move
  (Step 2 `applyMove`), which flips the side to move, then clears the selection.
- Activating anything else (an empty non-destination, an opponent piece, an
  immobile own piece, a lake): does not change selection meaningfully / is a
  no-op, so illegal moves are impossible to express (structural prevention).
- Expose derived data the UI needs: whose turn it is, the current selection, and
  the set of currently-actionable squares (own movable pieces when nothing is
  selected; the selected piece's legal destinations when something is selected).

Passing is never an operation — there is no "skip turn." If the side to move has
no legal move, the state machine simply offers no actionable squares (the accepted
"stuck" rough edge — no crash, no special handling).

Depends on: Step 1 (legal destinations) and Step 2 (`PlayState`, `applyMove`).

Verification (automated): Add a colocated `playSession.test.ts` and run
`npm test`. Cover: selecting an own piece exposes exactly its legal destinations;
selecting an opponent's or immobile piece exposes nothing; activating a legal
destination applies the move, flips the side, and clears the selection; activating
a non-destination is a no-op; turns strictly alternate across a sequence; and a
board with no legal move for the side to move yields an empty actionable set
without throwing.

---

## Step 7 — Phase 2 board component, phase transition, and turn indicator

Status: pending

Notes:

Deliver the visible entry into Phase 2. Build a new Phase-2 board component (e.g.
`src/board/PlayBoard.tsx`, distinct from the placement `Board.tsx`) that renders
the **full 12×12** board through the Step 5 accessible grid, using the Step 4
full-board orientation for the side to move, drawing **both armies** with
`PieceIcon` (Red for White, Blue for Black) and lakes with `LAKE_SYMBOL_ID`. Every
cell gets an accessible label (its square name plus what occupies it). Wire the
Step 6 state machine so cells are actionable per its derived data.

Then extend `src/App.tsx` to transition out of the placement flow into Phase 2:
from the neutral "both armies ready" terminal state (currently `SessionComplete`,
shown when `session.active === null`), the app **auto-advances** into Phase 2 —
**owner decision: no intermediate "reveal" button**. As soon as both players have
confirmed placement, build the `InitialGameState` (story 00000001's
`buildInitialGameState`), start a `PlayState` (`startPlay`) / Step 6 state
machine, and render the Phase-2 board with both armies revealed. (The neutral
`SessionComplete` boundary is superseded; if any of its content is still wanted it
can fold into the Phase-2 view, but no manual reveal gate is offered.) Add a
**turn indicator** using the
established color convention — "Red to move" / "Blue to move" (side `"white"` →
Red, `"black"` → Blue; the word "move", never "ply"). Reuse `PieceSpriteDefs` at
the app root.

At the end of this step the board is revealed and oriented and the turn indicator
is present; full move interaction is wired here too (via Step 6), but this step's
**gate verifies only the initial reveal** — movement/alternation/flip are
verified in Step 8.

Depends on: Steps 4 (orientation), 5 (accessible grid), 6 (state machine), and
story 00000001's `SessionComplete`/`buildInitialGameState`, `PieceIcon`.

Verification (manual — **Gate A**): Run `npm run dev`, complete a Phase-1 setup
(place both armies, e.g. via Auto-fill + Confirm for each side). Once the second
player confirms, the app **auto-advances** into Phase 2. Confirm: the app enters
Phase 2 showing **both armies on one
fully visible 12×12 board**, correctly oriented with **Red's own home edge nearest
the bottom**, lakes shown in place, with a clear **turn indicator reading "Red to
move"** (Red, the first player, moves first).

---

## Step 8 — Movement, turn alternation, and perspective flip

Status: pending

Notes:

With the Phase-2 board and state machine wired in Step 7, this step is where the
full move interaction is exercised and, if needed, completed: selecting a piece
shows its legal destinations, activating a destination performs the move, the turn
passes to the other player, and the board **re-orients (flips) to the new side to
move** so their army is in front of them. Ensure the selectable/actionable squares
and destination highlights render clearly, and that occupied squares are never
offered as destinations.

Because the perspective flip is only observable **through** a completed hand-off,
Gates B and C are verified together in one play session (they cannot be exercised
independently). Handle the accepted "stuck with no legal move" case quietly (no
crash, no special UI).

Depends on: Step 7 (board + state-machine wiring). Uses Steps 1, 2, 6.

Verification (manual — **Gate B** and **Gate C**): Run `npm run dev`, enter Phase
2, and play several moves. Confirm (Gate C): a **baseline piece** moves exactly
one square orthogonally; a **Skirmisher** moves up to 3 squares in a straight line
but is stopped short by a piece or a lake in its path; **Towers and the Flag offer
no move**; **no diagonal** move is ever possible; a square occupied by any piece
(friendly or enemy) is **not** an offered destination; a move is **blocked** by a
piece or lake in the path. Confirm (Gate C, turns): after each move the turn
**strictly alternates**, the turn indicator updates (Red ↔ Blue), and there is
**never a pass/skip option**. Confirm (Gate B): on each hand-off the board **flips
to the new player's perspective**, putting the active player's own army nearest
them.

---

## Step 9 — Accessible movement verification (keyboard and screen reader)

Status: pending

Notes:

Accessibility is built into Steps 5–8 (the board is operated only through the
accessible grid — there is no separate mouse-only movement path). This step is the
dedicated accessibility gate plus any small polish needed to pass it: confirm
Enter/Space activation, arrow-key navigation, always-visible focus, and the wording
of live-region announcements (piece selected and its legal-destination count; the
move made; whose turn it is). Adjust focus styling, ARIA labels, or announcement
strings as needed so the gate passes.

Depends on: Steps 5, 7, 8 (the accessible board and its wired interaction).

Verification (manual — **Gate D**): Run `npm run dev`, enter Phase 2, and — **with
the mouse put away** — play a full turn by keyboard alone: Tab to the board, use
arrow keys to reach one of your pieces, Enter/Space to select it, arrow to a legal
destination, Enter/Space to move. Confirm focus is **always visible and never
trapped** (you can Tab away from the board). Then, **with a screen reader on**
(e.g. NVDA, VoiceOver, or Orca), confirm it announces the **active piece and its
legal destinations**, the **move** when made, and **whose turn it is**.

---

## Step 10 — Surface the evolving move record (Gate E)

Status: pending

Notes:

Surface the evolving Phase-2 game state as an inspectable, developer-facing
artifact in the Phase-2 UI, reusing Step 3's render. Mirror the Phase-1 pattern
from `SessionComplete.tsx`: a collapsed `<details>` disclosure (and, gated to dev
builds, a `console.log`) showing the position block, the `Ruleset` tag
(`PRIMARY:1.1`), and the **move sequence in `A2A3` coordinate form**, updated as
each move is made. This is the foundation recorded-game replay will build on; do
not implement replay itself.

Depends on: Step 3 (record render), Steps 7–8 (a live `PlayState` to render), and
story 00000001's `SessionComplete` pattern for the `<details>` dump.

Verification (manual — **Gate E**): Run `npm run dev`, enter Phase 2, play a known
sequence of moves, and open the developer artifact. Confirm it is inspectable and
**correctly reflects the moves made, in `A2A3` form**, in order, alongside the
**ruleset version** (`PRIMARY:1.1`) — confirming the replay foundation.

---

## Step 11 — README accuracy check

Status: pending

Notes:

Review `README.md` against this story's changes and update it if warranted (the
`/update-readme` command automates this against the branch diff). The current
README says the battle phase is "coming next" and its status note says only setup
works; now that basic Phase-2 movement (no combat, no game-end) exists, update the
player-facing wording to reflect that players can begin moving pieces, while making
clear that attacks and winning are still to come. If, on review, no change is
warranted, record that conclusion in Notes.

Depends on: all prior steps (the README describes the delivered behavior).

Verification (automated): Run `npm run typecheck`, `npm run lint`, and `npm test`
and confirm all pass; then re-read `README.md` and confirm every statement it
makes about what the app can do matches the shipped behavior (or that it was
updated to match).

---

## Step 12 — Record the automated accessibility/DOM test stack as a future technical story

Status: pending

Notes:

**Owner decision captured here so it survives a fresh session:** for story
00000004 we deliberately do **not** add a DOM/component test stack — the repo's
Vitest `node` environment (no jsdom, no component-testing library) stays as-is, the
accessible grid's pure navigation math is unit-tested, and its ARIA / keyboard /
screen-reader behavior is covered only by the manual Gate D (Step 9). This step
does not change that decision; it **documents the deferred work** as a proposed
future technical story so it is not lost.

Create a short, non-numbered future-story stub at
`doc/plan/future-technical-stories/automated-accessibility-and-dom-testing.md`
(create the `future-technical-stories/` directory). It is a planning note, not a
numbered story (story numbers come from GitHub and are chosen by the owner), and
must state, for a cold reader:

- **Motivation** — the reusable accessible grid built in story 00000004 (Step 5,
  `src/board/grid/`) has its WAI-ARIA roles, roving `tabindex`, arrow-key
  navigation, Enter/Space activation, and live-region announcements verified only
  manually (Gate D). There is no automated regression coverage for that behavior,
  so a future refactor could silently break accessibility.
- **Proposed scope** — introduce a DOM/component test environment (e.g. jsdom plus
  a well-maintained component-testing library such as Testing Library, and
  optionally an ARIA assertion helper), then add automated tests for the accessible
  grid: roving tabindex invariants, arrow-key focus movement and edge clamping,
  Enter/Space activation, and live-region announcement content. Retrofit the same
  coverage onto any other interactive components that exist by then.
- **Dependency / constraints** — this is a tooling/dependency decision (new
  dev-dependencies) that was intentionally out of scope for 00000004; it must
  follow the repository dependency policy (major, well-maintained libraries only).
- **Relationship to other stories** — note that story 00000002 (accessible Phase-1
  placement) will adopt the same grid model, so its accessibility would benefit
  from this coverage too.

Do **not** invent a GitHub story number or create a numbered `doc/plan/NNNNNNNN-…`
folder for it.

Depends on: Step 5 (the accessible grid whose deferred automated coverage this
documents). No code/behavior change — documentation only.

Verification (automated): Run `npm run typecheck`, `npm run lint`, and `npm test`
and confirm all still pass (this step adds only a markdown file and changes no
code); then confirm the stub file exists at the path above and states the
motivation, proposed scope, dependency/constraints, and story-00000002
relationship listed here.
