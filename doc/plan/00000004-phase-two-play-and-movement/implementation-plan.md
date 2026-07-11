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
  square occupied by _any_ piece (friendly or enemy) is not a legal destination.
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
_starting_ position, and the move sequence is `N. WhiteMove BlackMove` rounds
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
Ruleset tag, the opening-position block (verified it does _not_ equal the
current board's block after moves), and round numbering including the
trailing White-only round. No other deviations.

Add a function (in `play.ts`, or a small sibling it imports) that renders a
`PlayState` into an inspectable, developer-facing text form that **anticipates the
recorded-game replay file format** without implementing replay. The format, per
the companion repository's `doc/ruleset/technical-notes.md` "Record file format",
has: the `Ruleset` tag (`PRIMARY:1.1`); the **position block** for the _starting_
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

Status: committed

Notes: Added `src/board/grid/gridNavigation.ts` (pure) exporting
`nextFocusPosition` and `firstFocusablePosition`, plus colocated
`gridNavigation.test.ts` (16 tests: each arrow's one-cell movement, edge/corner
clamping with no wraparound, and the focusable-mask skip policy).
**Skip policy** (documented in code): stepping in the pressed direction, the
nearest cell for which `isFocusable` is true is chosen — non-focusable cells
are skipped over; if the edge of the grid is reached before any focusable
cell is found, focus does not move at all (returns the unchanged current
position), so navigation always clamps and is never trapped on a
non-focusable cell. Added `src/board/grid/AccessibleGrid.tsx` (a generic,
piece-agnostic React component: `role="grid"`/`"row"`/`"gridcell"`, roving
`tabindex` via internal `focused` state synced to real DOM focus only while
focus is already inside the grid (so mount/re-render never steals focus),
arrow-key handling delegated to `nextFocusPosition`, Enter/Space and click
activation gated on each cell's `actionable` flag, and a `role="status"
aria-live="polite"` region driven by the consumer's `announcement` prop) and
colocated `AccessibleGrid.css` (a `--focus-ring` custom property, added to
`src/index.css`, drives a high-contrast, always-visible focus outline on the
focused cell; `.accessible-grid__row { display: contents }` lets the
ARIA-required row wrapper divs coexist with a CSS Grid layout on the
container). Per the plan, the component's ARIA/keyboard/live-region behavior
is **not** automated (no DOM test environment in this repo) — it is verified
manually in Gate D (Step 9); only the pure navigation math has automated
tests. No deviations from the plan.

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

Status: committed

Notes: Added `src/board/playSession.ts` exporting `PlaySession` (`{ play:
PlayState, selection: Square | null }`), `startSession(initial)`,
`actionableSquares(session)`, and `activateSquare(session, square)`, matching
`placementSession.ts`'s pure/immutable style. `actionableSquares` returns the
side-to-move's own pieces that currently have at least one legal destination
(nothing selected) or the selected piece's `legalDestinations` (something
selected) — an "own movable piece" is defined as having
`legalDestinations(...).length > 0`, not merely a non-immobile piece type,
so a boxed-in piece is never offered and the "stuck" case naturally yields
an empty actionable set without any special-case code.
`activateSquare` implements exactly the four cases from the plan: reactivating
the selected square deselects it; activating one of its legal destinations
applies the move via `applyMove` and clears the selection; activating one of
the side-to-move's own movable pieces (nothing selected) selects it; anything
else (opponent piece, immobile own piece, lake, non-destination empty square,
or a second own piece while one is already selected — not called out
separately by the plan, so treated as "anything else") is a no-op, returning
the input session unchanged. Added colocated `playSession.test.ts` (11 tests)
covering every case in the verification list, including a "stuck" fixture
(one White piece boxed in by four Black pieces, no other White piece on the
board) confirming an empty actionable set without throwing. No deviations
from the plan.

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

Status: committed

Notes: Added `src/board/PlayBoard.tsx` (+ colocated `PlayBoard.css`), which
renders the full 12x12 board through Step 5's `AccessibleGrid`, using Step
4's `fullBoardRows`/`visibleColumns` for `session.play.sideToMove`, drawing
both armies with `PieceIcon` (colored per side) and lakes with
`LAKE_SYMBOL_ID`; every cell's accessible label is its square name plus what
occupies it (e.g. "A2, Red Skirmisher", "F6, lake", "D5, empty", with
", selected" appended for the picked-up piece). Cells are marked
`actionable`/highlighted per Step 6's `actionableSquares`, and activation is
reported up as a domain `Square` for the caller to route through
`activateSquare`. Added `src/board/PlayStatus.tsx` (+ `PlayStatus.css`), a
small "Red to move" / "Blue to move" indicator reusing
`PlacementStatus.tsx`'s color convention. Extended `src/App.tsx` with a new
`playSession` state (`PlaySession | null`); `handleConfirm` now reads
`confirmActive(session)` directly (rather than via a `setSession` functional
updater, so the resulting `next.active` is available synchronously) and,
when both players have just confirmed, immediately builds the
`InitialGameState` (`buildInitialGameState`) and starts a `PlaySession`
(`startSession`) in the same event — both `setSession`/`setPlaySession`
calls batch into one render, so the app auto-advances into Phase 2 with no
intermediate "reveal" affordance, per the owner decision. The old
`session.active === null` branch that rendered `SessionComplete` was
removed (superseded, per the plan); `SessionComplete.tsx`/`.css` were left
in place, unused, since deleting them was not requested and they are
harmless dead code. `PieceSpriteDefs` continues to be mounted once, at the
app root, for both the placement and Phase-2 views.

Verification: `npm run typecheck`, `npm run lint`, `npm test` (134 tests,
all passing), and `npm run format:check` all pass; `npm run build` (`tsc -b
&& vite build`) also succeeds. Gate A (initial reveal) itself is manual and
was not run here — see the owner's manual verification.

Deviations: (1) `handleConfirm` switched from a `setSession` functional
updater to reading `session` directly from the closure, so the freshly
confirmed `PlacementSession` is available synchronously to decide whether to
start Phase 2 in the same handler — safe here since `handleConfirm` only
runs once per click and isn't racing other updates to `session`. (2) Kept a
defensive (never-actually-reachable) `if (session.active === null) return
null;` branch purely so TypeScript can narrow `session.active` to `Side` for
the placement-UI code below it; documented in-code as unreachable given
`handleConfirm`'s batching. Neither changes any behavior described in the
story or plan.

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

Status: committed

Notes: Reviewed the end-to-end wiring landed in Step 7 line by line
(`App.tsx` → `activateSquare` (`playSession.ts`) → `applyMove`/`legalDestinations`
(`play.ts`/`movement.ts`) → `PlayBoard.tsx` re-rendering via `fullBoardRows(session.play.sideToMove)`)
and confirmed it is already complete and correct: selecting an own movable
piece surfaces exactly its `legalDestinations` as actionable; activating a
destination calls `applyMove`, which flips `sideToMove` and appends the move
record; the next render reads the new `sideToMove` and `fullBoardRows`
re-orients the board so the new active player's home rank is nearest them.
Confirmed via `movement.ts`/`movement.test.ts` (already committed in Step 1)
that occupied squares are never returned as destinations, no diagonal is
possible, Skirmisher rays stop at the first lake/occupied square without
including the blocker, and Tower/Flag return no destinations - so Gate C's
rule-level behaviors are enforced structurally, not by new code here.
Confirmed the "stuck" case (`playSession.test.ts`'s boxed-in fixture)
already yields an empty actionable set with no crash and no special UI, per
the accepted rough edge. The only change made: **CSS-only polish** to
`PlayBoard.css` - added a faint background fill to the `--selected`
(ink-tinted) and `--actionable` (amber-tinted) square modifiers, in addition
to the existing inset box-shadow borders, so the "piece picked up" and
"square you can currently act on" states are unambiguous and easy to spot at
a glance across the full 12x12 board (previously border-only, which was
already technically distinct by color but harder to notice at a glance on a
larger board than Phase 1's cropped view). No other code changes; no new
rule logic; no second interaction path. Ran `npm run typecheck`, `npm run
lint`, `npm test` (134 tests), `npm run format:check`, and `npm run build` -
all pass. Gates B and C themselves are manual and were not run here - see
the owner's manual verification. Deviation: none from the plan's intent -
the plan explicitly anticipated this step could be "small... CSS polish
only" if the Step 7 wiring proved correct, which is what happened here.

Owner-approved during Gate B/C: activating a different own movable piece
now switches the selection rather than being a no-op; covered by new
`playSession.test.ts` cases. `npm run typecheck`, `npm run lint`,
`npm test` (136 tests), and `npm run format:check` all still pass.

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

Status: committed

Notes: Reviewed Steps 5-8's existing wiring and confirmed keyboard/focus
behavior needed no changes (Tab reaches the roving-tabindex cell, arrow keys
move one cell in screen space and clamp at every edge with no wraparound
since `PlayBoard` marks every cell `focusable: true`, Enter/Space activates
via `AccessibleGrid`'s existing handler, and `AccessibleGrid.css`'s
`--focus-ring` outline is always visible on the focused cell) - so the only
real gap was live-region wiring: nothing was pushing text into
`AccessibleGrid`'s `announcement` prop. Added
`src/board/playAnnouncement.ts` (`describeActivation(before, after,
square)`, pure, no React) that derives the Gate D announcement sentence from
a `PlaySession` transition: selecting/switching a selection announces
"{Red|Blue} {Piece} selected, N move(s) available."; completing a move
announces "{Red|Blue} {Piece} moved to {square}. {Red|Blue} to move." (the
whose-turn sentence is appended here, deliberately the only place turn
information is pushed to assistive technology, so `PlayStatus` stays a plain
visual indicator and nothing is announced twice); reactivating the selected
square announces "{Red|Blue} {Piece} deselected."; a no-op activation (not
reachable through the UI, since only actionable cells can be activated)
returns "" rather than throwing. Added colocated `playAnnouncement.test.ts`
(8 tests) covering every case, including singular "1 move available"
wording and both sides' color names. Wired it into `App.tsx`: added a
`playAnnouncement` state string, and the Phase-2 `onActivate` handler now
computes `describeActivation(playSession, next, square)` alongside applying
`activateSquare`, passing the result to a new `PlayBoard` `announcement`
prop, which forwards it to `AccessibleGrid`. Ran `npm run typecheck`, `npm
run lint`, `npm test` (144 tests, all passing, 8 new), `npm run
format:check`, and `npm run build` - all pass. Gate D itself is manual and
was not run here - see the owner's manual verification.

Follow-up fix (owner-requested, folded into this step): while reviewing the
wiring above, found that `playSession.ts`'s "activate a different own
movable piece switches the selection" and "reactivate the selected piece to
deselect it" behaviors (tested at the state-machine level in
`playSession.test.ts`, Steps 6/8) were not reachable through the UI, because
`PlayBoard.tsx` only marked a selected piece's _legal destinations_ as
`actionable` when something was selected - not the selected piece itself,
nor the side's other own movable pieces. The owner asked for these gestures
(switch-selection was explicitly requested and folded into Step 8; deselect
should work too) to be made reachable as part of this step. Fixed by adding
`activatableSquares(session)` to `playSession.ts`: the exact set of squares
for which `activateSquare` would return a different session (own movable
pieces - which already includes the currently selected piece, since it was
only selectable because it is one, which is what makes deselect reachable -
unioned with the selected piece's legal destinations when something is
selected; reuses the existing `isOwnMovablePiece` predicate rather than
duplicating it). Added 6 colocated tests in `playSession.test.ts` (150
tests project-wide) covering nothing-selected, a piece selected (own movable
incl. the selected square, union destinations), and exclusion of immobile
own pieces, opponent pieces, and non-destination empties. `PlayBoard.tsx`
now uses `activatableSquares` for each cell's `GridCellDescriptor.actionable`
(the accessible grid's click/Enter/Space activation gate), while continuing
to use the original `actionableSquares` for the `--selected`/`--actionable`
visual highlight classes only - so highlighting is unchanged, but switching
selection and deselecting now work by both mouse and keyboard.
`playAnnouncement.ts`'s `describeActivation` needed no changes: it already
handled the selection-switched and deselected cases (added in the base Step
9 work above), and now actually fires for them since `onActivate` is
invoked. Re-ran `npm run typecheck`, `npm run lint`, `npm test` (150 tests,
all passing), `npm run format:check`, and `npm run build` - all pass.

Gate D result (owner-run manual verification): PASSED. Keyboard-only play
works end to end - Tab reaches the board, arrow keys move the focus one cell
in screen space and clamp at edges, Enter/Space selects and moves, and focus
is not trapped (Tab leaves the board). With a screen reader (Windows
Narrator), the polite live region announces the selected piece and its move
count, the move made and its destination, and whose turn it is. Note: as a
`role="grid"` composite widget the board owns the arrow keys, so the screen
reader must be in focus mode (Narrator: Caps Lock + Space to leave scan mode;
NVDA auto-switches on entering a grid) for arrow navigation to reach the
board - expected ARIA-grid behavior, not an app defect.

Gate D polish (folded into this step): manual testing surfaced two focus/
highlight issues, both fixed. (1) The keyboard-focus ring was invisible:
`AccessibleGrid.css` drew it as an `outline` with a negative `outline-offset`
on the cell, which the consumer's positioned, background-filled child
(`.play-board__square`) painted over, leaving no visible ring. Replaced with
an overlay `::after` pseudo-element (a later-painted, higher-`z-index`
sibling of the cell content) so the ring always lands on top. (2) At the
owner's request the visual model was simplified so the amber _border_ is
reserved exclusively for keyboard focus: the ring now shows only on
`:focus-visible` (no ring on load or on mouse focus; the roving target still
updates on click so arrow keys continue from there); own movable pieces are
no longer highlighted when nothing is selected; and a selected piece's legal
destinations use a background tint only, no border. CSS class
`.play-board__square--actionable` renamed to `--destination` and the
`PlayBoard` cell prop `actionable` renamed to `destination` to match the
narrowed meaning (`GridCellDescriptor.actionable`, the grid's activation
gate, is unrelated and unchanged, so every own movable piece is still
clickable/Enter-able even without a highlight). Re-ran `npm run typecheck`,
`npm run lint`, and `npm test` (150 tests, all passing) - all pass.

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
