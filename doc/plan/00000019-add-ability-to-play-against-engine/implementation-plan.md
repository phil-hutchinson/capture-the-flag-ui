# Implementation plan — Story 00000019: Play against the engine (baseline)

This plan delivers a genuinely playable, end-to-end path — encode the board,
run the reference network in the browser, decode a legal move, play it through
the same rules the hot-seat game uses — with the zero-weight reference model
(so the computer plays effectively at random, by design). Read `story.md` in
this folder first; it fixes every player-visible policy decision and is not
reopened here.

## Grounding facts (read before implementing any step)

These are the concrete, verified facts a cold-reader implementer needs. They
were confirmed against the current codebase and against the ENG_NN_1 spec as
it stands at plan time (companion repo
`doc/neuralnetwork/eng-nn-1.md`, fetched 2026-07-21).

### The rules engine (already exists — drive it, never reimplement it)

- `src/rules/primary/v1/board.ts` — geometry. `Column` `"A"`–`"L"` with
  `COLUMNS` giving index (A=0 … L=11); `Row` `1`–`12` (row 1 = White's back
  rank, row 12 = Black's back rank); `Side = "white" | "black"`; `Square`,
  `squareKey`, `allSquares`, `isLake`, `otherSide`, `homeSquares`.
- `src/rules/primary/v1/pieces.ts` — `PieceTypeId` is
  `"masterOfArms" | "champion" | "knight" | "halberdier" | "footSoldier" |
  "militia" | "tower" | "flag"`. **Note:** `PIECE_TYPES` order here is *not*
  the ENG_NN_1 plane order (see below); the encoder needs its own explicit
  plane-index map.
- `src/rules/primary/v1/gameState.ts` — `BoardState` is
  `Readonly<Record<string, PlacedPiece>>` keyed by `squareKey` in White's
  absolute frame; `PlacedPiece` is `{ side, pieceType }`; `InitialGameState`
  is `{ ruleset, board }`; `buildInitialGameState(white, black)`;
  `RULESET_TAG = "1.2:PRE-RELEASE"`.
- `src/rules/primary/v1/movement.ts` — `legalDestinations(board, origin)`
  (plain-move target squares), `legalAttacks(board, origin)` (enemy squares
  attackable), `hasAnyLegalPly(board, side)`. Every legal ply is one or two
  squares orthogonally; the two sets are disjoint.
- `src/rules/primary/v1/play.ts` — `PlayState`
  (`{ ruleset, initialBoard, board, sideToMove, moves, inactivityCounter,
  result }`), `startPlay(initial)`, `applyMove(state, from, to)` →
  `{ state, outcome }`. White moves first. `result` is a `GameOutcome` from
  `outcome.ts`.
- `src/rules/primary/v1/outcome.ts` — `INACTIVITY_LIMIT = 50` (the draw
  threshold); `computeOutcome`, `GameOutcome`, `GameEndReason`.
- `src/rules/primary/v1/placement.ts` — `autoFill(state, random?)` returns a
  valid random 25-piece army respecting the no-adjacent-Towers rule;
  `RandomSource = () => number` defaults to `Math.random` (the injectable-
  random pattern to copy).

### The Phase-2 session and UI (reuse — do not fork)

- `src/board/playSession.ts` — `PlaySession`
  (`{ play, selection, lastOutcome, drawOffer }`), `startSession(initial)`,
  `activateSquare(session, square)`, `viewSide(session, flipBetweenTurns)`.
  No React dependency.
- `src/board/PlayBoard.tsx` — presentational Phase-2 board driven by a
  `PlaySession`; already extracted from the game so it can be reused.
- `src/board/HotSeatGame.tsx` — the hot-seat game (placement then play). It
  composes already-extracted sub-components the new mode reuses directly:
  `PlayBoard`, `GameResult`, `PlayStatus`, `GameRecord`, `LeaveGameDialog`,
  `PlacementStatus`, `PlacementControls`, `Board`, `Tray`, and the placement
  session helpers in `src/board/placementSession.ts`. Reusing these (plus
  `PlaySession` as the play state) satisfies the story's "must not fork the
  board component, piece rendering, or play state" — only the small "who
  supplies the next move" wrapper is genuinely new. Do **not** extract a new
  shared shell unless it proves the cleanest way to avoid duplicating the
  hot-seat play loop; reusing the existing sub-components is sufficient.
- `src/board/playAnnouncement.ts` — `describeActivation`, `describeResult`,
  etc., the live-region sentences the hot-seat game announces.
- `src/App.tsx` — the screen shell: a `useState` discriminated union
  `Screen` with kinds `start | play | import | review`, no router. This story
  adds a new kind for the against-the-computer mode.
- `src/app/StartScreen.tsx` — two choice buttons ("Play a game", "Review a
  game"); this story adds a third.

### ENG_NN_1 tensor contract (confirmed against the spec at plan time)

- **Input:** `(18, 12, 12)` float tensor `(plane, row, col)`, always from the
  **mover's** (side-to-move's) perspective. At inference the model takes a
  leading batch axis: `(1, 18, 12, 12)`.
- **Coordinate mapping** (board `Square` → tensor `(row, col)`):
  - White to move: `tensorRow = boardRow − 1`; `tensorCol = columnIndex`
    (A=0 … L=11).
  - Black to move: `tensorRow = 12 − boardRow`; `tensorCol = 11 − columnIndex`.
  - i.e. the board rotates 180° for Black; the mover's own back rank is always
    tensor row 0 and the mover advances toward increasing row.
- **Piece planes (mover's-perspective plane order — this is the encoder's own
  order, distinct from `PIECE_TYPES`):** 0 our Flag, 1 our Tower, 2 our
  Master-of-Arms, 3 our Champion, 4 our Knight, 5 our Halberdier, 6 our Foot
  Soldier, 7 our Militia; 8–15 the opponent's, same order. "Our" = the side to
  move; "their" = the other side. A plane cell is 1 if such a piece is present
  on that square, else 0.
- **Plane 16 (Passable):** 1 for playable squares, 0 for the 12 lake squares
  (`isLake`). (Lakes are symmetric under 180° rotation, but map through the
  same coordinate transform anyway for generality.)
- **Plane 17 (Inactivity):** every cell = `inactivityCounter / 50`
  (`INACTIVITY_LIMIT`), filled uniformly.
- **Value head:** a single scalar in `[−1, 1]`, from the mover's perspective
  (+1 = the side to move is winning).
- **Policy head:** `(8, 12, 12)` = `(movementIndex, row, col)`. Row/col are the
  ply's **source** square in the same mover-perspective frame as the input;
  the movement index gives the destination as an offset from the source.
  Entries are **raw logits** (not probabilities); only legal entries are
  meaningful — mask to the legal plies, softmax over that legal set, sample.
- **Movement index → offset (tensor-frame `Δrow, Δcol`):** 0 up-one `(+1, 0)`,
  1 right-one `(0, +1)`, 2 down-one `(−1, 0)`, 3 left-one `(0, −1)`, 4 up-two
  `(+2, 0)`, 5 right-two `(0, +2)`, 6 down-two `(−2, 0)`, 7 left-two
  `(0, −2)`. "Up"/increasing row = the direction the mover advances. Every
  legal ply (one or two squares orthogonally) maps to exactly one of these
  eight indices.
- **Flat policy index** into the length-1152 array:
  `movementIndex * 144 + tensorRow * 12 + tensorCol`.
- **Tensor names:** the spec does **not** name the input/output tensors, and
  the model file is the only source of truth for them. Discover them at load
  time from the ONNX session (`session.inputNames` / `session.outputNames`)
  and identify the two outputs by element count — the **value** output has 1
  element, the **policy** output has 1152 (`8 × 12 × 12`) — rather than
  hardcoding names the spec omits. Step 3 records the observed names in its
  Notes for reference.

### Encoding lives on its own version axis

Per the story, the encoder mirrors the folder-per-version layout of
`src/rules/primary/`, but on the *encoding* axis (which versions separately
from the ruleset). Use `src/encoding/eng-nn-1/` as the encoding-v1 folder
(named for the spec, `ENG_NN_1`). A shared coordinate/plane-constants module in
that folder is used by both the encoder (Step 1) and the policy decoder
(Step 2).

### Toolchain

- Scripts: `npm run typecheck`, `npm run lint`, `npm run test` (vitest,
  `environment: "node"`), `npm run build`, `npm run dev`, `npm run format:check`.
- Tests are logic-level `*.test.ts` files (no React component tests exist);
  the ESLint `no-restricted-imports` rule bans `node:*` imports outside
  `*.test.ts`. Keep the encoder/decoder/engine-player modules pure and free of
  React so they unit-test the same way the rules engine does.
- Every step must leave `typecheck`, `lint`, and `test` green and be committed
  before the next begins.

---

## Step 1 — Board-state encoder (encoding v1)

Status: pending

Implement the ENG_NN_1 **input encoder**: a pure module under
`src/encoding/eng-nn-1/` that turns a position — a `BoardState`, the side to
move, and the inactivity counter — into the `(18, 12, 12)` float input tensor
described in Grounding facts, as a flat `Float32Array` of length
`18 * 12 * 12 = 2592` in `(plane, row, col)` row-major order, together with its
shape metadata (dims `[1, 18, 12, 12]` for the batch-of-one the model expects).
Include a shared helper in the same folder for the two things Step 2 also
needs: the mover-perspective coordinate transform (`Square` →
`(tensorRow, tensorCol)`, per-side) and the ENG_NN_1 plane-order constants
(the piece-type → plane-index map, distinct from `PIECE_TYPES`). Encode the
mover's pieces into planes 0–7 and the opponent's into 8–15 in the spec's
order, the passable plane (16), and the uniform inactivity plane (17, value
`inactivityCounter / INACTIVITY_LIMIT`).

Do not add onnxruntime or any UI here — this step is a pure, self-contained
function proven by unit tests.

Depends on: nothing new (only the existing rules engine). Steps 2 and 3 build
on its coordinate transform and plane constants.

Verification (automated): Add `src/encoding/eng-nn-1/*.test.ts` covering
hand-built positions and run `npm run test`. Assert at minimum: (a) for a White-
to-move position, a piece on a known square lands in the correct plane and
`(row, col)` per the White mapping (`tensorRow = boardRow − 1`,
`tensorCol = columnIndex`); (b) the *same* board with Black to move rotates
180° (`tensorRow = 12 − boardRow`, `tensorCol = 11 − columnIndex`) and swaps
the our/their plane groups; (c) the passable plane is 0 exactly on the 12 lake
squares and 1 elsewhere; (d) the inactivity plane is uniformly
`counter / 50`; (e) the flat array length is 2592 and every value is 0 or the
expected fraction. Also run `npm run typecheck` and `npm run lint`.

---

## Step 2 — Policy decode, legal mask, and sampling

Status: pending

Implement the pure move-selection logic under `src/encoding/eng-nn-1/`: given a
policy tensor (a `Float32Array` of length 1152 in `(movementIndex, row, col)`
order, the network's raw logits), the current `BoardState`, the side to move,
and an injectable `RandomSource` (default `Math.random`, same pattern as
`autoFill`), return the chosen ply as a `{ from, to }` pair of `Square`s.

The logic, exactly: (1) enumerate the **legal** plies from the rules engine —
for each of the side-to-move's own pieces, `legalDestinations` and
`legalAttacks`; (2) for each legal `(from, to)`, map `from` to its tensor
`(row, col)` via Step 1's coordinate transform, compute the tensor-frame offset
from `from` to `to` (transform both squares and subtract), match that offset to
one of the eight movement indices, and read the corresponding logit at flat
index `movementIndex * 144 + tensorRow * 12 + tensorCol`; (3) softmax over
**only** those legal logits; (4) sample one ply from that distribution using
the injected random source. If the side to move has no legal ply at all, the
game is already over (`computeOutcome`), so the caller never asks — but the
function should fail loudly (throw) rather than return an invalid ply, since
that would be a programming-invariant violation.

The mask is always authoritative: an illegal or off-board policy index can
never be selected, because only legal plies are ever considered. This is the
invariant the whole story's correctness rests on.

Depends on: Step 1 (reuses its coordinate transform and plane constants; both
must map identically).

Verification (automated): Add `*.test.ts` and run `npm run test`. Assert:
(a) with a hand-built policy that puts all its mass on one legal ply, that ply
is always chosen; (b) every legal `(from, to)` maps to a distinct, in-range
flat policy index, and the movement-index/offset table matches the spec for
both one- and two-square plies in all four directions, for White *and* Black to
move (the Black case exercises the 180° offset sign flip); (c) with a seeded
`RandomSource`, sampling is deterministic and reproducible; (d) over a spread of
positions and random seeds the chosen ply is **always** in the engine's legal
set (never an illegal or off-board move). Also run `npm run typecheck` and
`npm run lint`.

---

## Step 3 — Model loading and in-browser inference

Status: pending

Bundle the network and run it in the browser. Concretely:

1. Add **onnxruntime-web** as a dependency (a major, well-maintained library
   from Microsoft — allowed under CONTRIBUTING's dependency policy; add it as
   its own commit-worthy dependency change with `package-lock.json` updated).
2. Commit the reference model as a served static asset. Copy
   `.local/ctf_reference.onnx` (~95 KB, zero weights) to a served location —
   recommend `public/models/ctf_reference.onnx` (Vite serves `public/` at the
   site root, so it becomes `/models/ctf_reference.onnx`, consistent with
   static-file hosting and no backend). The `.local/` original is gitignored;
   this committed copy is the story's deliverable and is expected to be
   replaced when real models arrive.
3. Ensure onnxruntime-web's WASM binaries are served as static assets too
   (single-threaded WASM; do **not** assume COOP/COEP headers a static host
   can't set). Configure the runtime's `wasmPaths` to a served location and/or
   copy the `.wasm`/loader files into `public/` as needed so the app loads
   them without a CDN. Verify the production `build` includes them.
4. Implement an inference module (its own file, e.g. under `src/engine/`) that
   loads the ONNX `InferenceSession` **once** (lazily, cached) from the served
   model URL, and exposes an **async** function that takes a position, calls
   Step 1's encoder, runs the session, and returns `{ value, policy }` — the
   value scalar and the length-1152 policy `Float32Array`. Identify the two
   outputs by element count (value = 1, policy = 1152) rather than by
   hardcoded names (the spec does not name the tensors); feed the input using
   the session's discovered input name. Keep the boundary a `Promise` so a Web
   Worker can be dropped in later without reshaping the flow (Web Worker is
   out of scope this story; the main thread is expected to be adequate for the
   zero-weight model).

Do not wire this into any game screen yet — this step delivers the loadable,
runnable model in isolation, exercised by a temporary manual smoke.

Depends on: Step 1 (the encoder feeds the session). Independent of Step 2.

Verification (manual): Run `npm run dev` and, from a throwaway smoke harness
(a temporary button/effect in the app, or a temporary dev-only module invoked
from the browser console) that calls the inference function on a fixed
starting position, confirm in the browser: (a) `/models/ctf_reference.onnx`
and the onnxruntime WASM asset(s) load with HTTP 200 (Network tab) — no CDN,
no missing-file 404, no cross-origin-isolation error; (b) the value is a finite
number in `[−1, 1]` and the policy `Float32Array` has length 1152; (c) the load
does not visibly jank the UI. Record the model's observed input/output tensor
names in this step's Notes. Remove the throwaway harness before committing.
Also run `npm run build` and confirm the model and WASM assets appear in
`dist/`. Run `npm run typecheck`, `npm run lint`, `npm run test`.

---

## Step 4 — Engine move selection (async, drives the engine)

Status: pending

Implement the async engine-player function (e.g. under `src/engine/`) that ties
inference (Step 3) to decode/mask/sample (Step 2): given a `PlayState` (or the
board + side to move + inactivity counter it needs) and an injectable
`RandomSource`, it returns a `Promise` of the chosen `{ from, to }` ply — by
running the network on the position, then sampling a legal ply from the masked
policy. To keep it unit-testable without loading WASM, make the network
evaluation an **injectable dependency** (a function `position → { value,
policy }`), defaulting in production to Step 3's real inference; tests pass a
fake evaluator returning a hand-built policy. Exactly one evaluation per move;
no tree search.

This is the single seam the play loop will call on the computer's turn. It
never applies the move itself (the caller does, through `applyMove`), and it
only ever returns a ply the rules engine reports as legal (guaranteed by
Step 2).

Depends on: Step 2 (sampling) and Step 3 (inference). Uses Step 3's evaluator
in production but accepts a fake in tests.

Verification (automated): Add `*.test.ts` and run `npm run test`. With a fake
evaluator and seeded random, assert: (a) the returned promise resolves to a ply
that is in the engine's legal set for the given position; (b) over many random
`autoFill`-generated mid-game positions (both sides to move) and many seeds,
the chosen ply is **always** legal and on-board — never illegal, never off the
board; (c) sampling is deterministic under a fixed seed and fake policy. Also
run `npm run typecheck`, `npm run lint`.

---

## Step 5 — New mode: entry, side choice, placement, and the play loop

Status: pending

Wire the against-the-computer mode into the app as a genuinely playable slice,
reusing the existing placement and play components (Grounding facts — do not
fork the board, piece rendering, or `PlaySession`). Deliver:

1. **Start-screen third choice.** Add a third button to `StartScreen.tsx`
   ("Play against the computer", with a short plain-language detail line),
   alongside "Play a game" and "Review a game", wired to a new callback.
2. **App screen union.** Add a new screen kind to `App.tsx`'s `Screen` union
   for this mode and mount a new game component for it, mirroring how `play`
   mounts `HotSeatGame`.
3. **Side choice.** On entering the mode, first ask the player to **play as
   red** or **play as blue** (red = White = first player; blue = Black =
   second). Provide a way back to the start screen from the side choice.
   Red moves first, so choosing blue means the computer (red) makes the first
   move.
4. **Placement.** The human places their own 25-piece army with the existing
   placement flow (tray, board, tower-adjacency rule, messaging) — for the
   human's chosen side only. The computer's army is generated by `autoFill`
   (a valid random arrangement, no two Towers adjacent) and is **not** shown
   before play. Build the `InitialGameState` from the human's placement and the
   computer's `autoFill` army and `startSession` into Phase 2.
5. **Turn flow.** On the human's turn the board behaves exactly as in hot-seat
   (reuse `PlayBoard` + `activateSquare`). On the **computer's** turn the board
   is inert, a "the computer is thinking" indicator shows (announced, not just
   shown — a live region), and the async engine-move (Step 4, real inference,
   `Math.random`) resolves and is applied through the **same `applyMove`
   path** the human uses. Model "waiting for the computer" as a real state (the
   move is a `Promise`). The board is drawn from the human's perspective and
   does not flip (no "flip between turns" control in this mode). There is no
   draw-offer control.
6. **Leaving and fresh restart.** Reuse the hot-seat "Back to start" +
   `LeaveGameDialog` pattern: leaving mid-placement or mid-play warns the game
   will be lost and, on confirm, returns to start; cancelling leaves the game
   untouched. Entering the mode again starts cleanly — fresh side choice, fresh
   placement, fresh random computer army.

Be careful with React effects: trigger the computer's move when (and only when)
it becomes the computer's turn and the game is ongoing, guard against
double-firing and against applying a stale move after the player has left the
screen (the component may unmount mid-thought).

Depends on: Step 4 (the engine move) and the existing placement/play components.

Verification (manual): Run `npm run dev` and perform **Gate A** and **Gate D**
from `story.md`:
- Gate A — The start screen shows the third choice. Choosing it lets you pick a
  side and place your army; play then begins with both armies on the board —
  yours as you placed it, the computer's a valid random arrangement with no two
  Towers adjacent. Choosing **blue**, the computer (red) makes the first move;
  choosing **red**, you move first. (This inherently exercises at least one
  computer move.)
- Gate D — Going back to the start screen mid-game warns the game will be lost
  and, on confirm, returns to start; cancelling leaves the game untouched and
  playable. Starting a new game against the computer begins cleanly (fresh side
  choice, fresh placement, fresh random computer army).

Also confirm the hot-seat and review modes are unchanged. Run `npm run
typecheck`, `npm run lint`, `npm run test`.

---

## Step 6 — A full game and its endings

Status: pending

With the loop wired (Step 5), verify and finish the game-completion behavior:
the result screen names the winner by color (e.g. "Red wins", "the computer
(blue) wins", matching the other modes' phrasing), the "computer is thinking"
indicator has whatever minimum-visible treatment keeps an instant move (the
tiny model resolves near-instantly) from flashing distractingly (presentation
choice — a brief minimum visible duration is acceptable), and all three
automatic endings fire correctly with no draw-offer control present. Reuse the
existing `GameResult`, `PlayStatus`, `GameRecord`, and `playAnnouncement`
sentences; adapt only the winner phrasing to name "the computer".

Fix any defects surfaced by playing a complete game — in particular, confirm
the computer never produces an illegal or off-board move across a whole game,
including near the flag and against Towers (the Step 2/4 invariant, observed in
practice).

Depends on: Step 5 (a playable loop to run to completion).

Verification (manual): Run `npm run dev` and perform **Gate B** and **Gate C**
from `story.md`:
- Gate B — Play a complete game end to end. On your turn the board behaves as
  in hot-seat. On the computer's turn a "thinking" indicator shows, the board
  is inert, then the computer makes **exactly one legal move** — a plain move,
  a two-square unencumbered move, or an attack with the correct removals — and
  play continues. Over a full game (including moves near the flag and against
  Towers) the computer **never** makes an illegal or off-board move.
- Gate C — A flag capture in either direction ends the game with the right
  winner named by color; a no-legal-move loss and the 50-move inactivity draw
  both still fire and read correctly on the result screen; there is no
  draw-offer control.

Run `npm run typecheck`, `npm run lint`, `npm run test`.

---

## Step 7 — Accessibility

Status: pending

Extend the established grid and live-region patterns so the new mode is fully
keyboard-operable and conveyed to assistive technology: the side choice is a
proper keyboard-operable control with a visible, untrapped focus; the "computer
is thinking" state is **announced** (a live region), not merely shown; each
computer move is announced like a human move (reuse `playAnnouncement.ts`'s
`describeActivation`/`describeResult` so the piece, where it moved, any capture,
and whose turn it now is are all spoken); and focus lands sensibly on entering
the mode (mirror the heading-focus pattern the other screens use). No new
board or grid component — extend what exists.

Depends on: Steps 5 and 6 (the mode must be fully playable to verify its
accessibility).

Verification (manual): Perform **Gate E** from `story.md`: with the mouse put
away, a full game against the computer is playable by keyboard alone; with a
screen reader on, the side choice, the "computer is thinking" state, each
computer move, and the result are announced, and focus stays visible and
untrapped. Run `npm run typecheck`, `npm run lint`, `npm run test`.

---

## Step 8 — README check

Status: pending

Verify `README.md` is accurate given this story's changes and update it if
warranted. The current README's "What you can do" list has a **"Play against
the computer — _(planned, once the AI engine is trained)_"** bullet and a
**Status** note saying playing against the computer is "still to come"; this
story makes it real, so both should be updated to describe the new mode in
plain, player-facing language (choose a side, place your army, play the
computer, which currently plays at random with the placeholder model — worded
for players, not as a technical caveat). Check whether CONTRIBUTING or any
setup instructions need a note about the new dependency/assets (developer-
facing); update only if the story actually changed something they describe.
The `/update-readme` command may be used.

Depends on: all prior steps (the feature must be final before its docs).

Verification (manual): Re-read `README.md` against the shipped behavior and
confirm every claim about the against-the-computer mode is accurate and
player-appropriate. Run `npm run typecheck`, `npm run lint`, `npm run test`,
and `npm run format:check`.
