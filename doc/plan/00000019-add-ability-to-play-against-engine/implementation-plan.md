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

Status: committed

Notes: Created `src/encoding/eng-nn-1/shared.ts` (the mover-perspective
coordinate transform `toMoverFrame`, `flatIndex`, `PLANE_PIECE_ORDER` /
`PIECE_PLANE_INDEX`, and the plane-offset/size constants) and
`src/encoding/eng-nn-1/encoder.ts` (`encodePosition`, taking a `Position`
of `{ board, sideToMove, inactivityCounter }` and returning
`{ data: Float32Array(2592), dims: [1, 18, 12, 12] }`), plus
`shared.test.ts` and `encoder.test.ts` covering all five verification
assertions (White mapping, Black 180° rotation with our/their plane swap,
passable-plane lake exclusion, uniform inactivity plane, and shape/length).
No deviations from the plan; `npm run typecheck`, `npm run lint`, and
`npm run test` are all green (445 tests passing, 17 new). Ran
`npx prettier --write` on the new files to match the repo's formatting
convention (not explicitly required by this step's verification list, but
consistent with `npm run format:check` used elsewhere in the pipeline).

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

Status: committed

Notes: Created `src/encoding/eng-nn-1/decoder.ts` (`selectEnginePly` -
enumerates legal plies via `legalDestinations`/`legalAttacks`, maps each to
its flat policy index with `policyIndexForPly` - reusing `shared.ts`'s
`toMoverFrame` and `flatIndex` directly, since `flatIndex`'s `plane`
parameter already computes the exact `movementIndex * 144 + row * 12 + col`
formula ENG_NN_1 specifies - takes the softmax over only the legal logits,
and samples via an injectable `RandomSource`; throws if there is no legal
ply) plus `decoder.test.ts` covering all four verification assertions: (a)
all-mass-on-one-ply selection for a spread of random draws including a
near-1 edge value, (b) the `MOVEMENT_OFFSETS` table against the spec plus
`policyIndexForPly` checked against an independently-computed tensor
transform (not `shared.ts`'s) for one- and two-square plies in all four
directions for both White and Black (the Black cases exercise the 180-degree
sign flip), plus a real-position check that all 8 legal plies from one
origin land on distinct in-range indices, (c) reproducibility under a fixed
seeded `RandomSource` (same LCG pattern as `placement.test.ts`), and (d) a
spread of positions (several seeded `autoFill` initial armies plus a
hand-built denser position), both sides to move, and multiple seeds/policy
fills, asserting the chosen ply is always in the independently-recomputed
legal set. No deviations from the plan. `npm run typecheck`, `npm run lint`,
and `npm run test` are all green (468 tests passing, 23 new). Ran `npx
prettier --write` on both new files.

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

Status: committed

Notes: Added **onnxruntime-web** (`^1.27.0`) as a dependency
(`package.json`/`package-lock.json`). Committed the reference model at
`public/models/ctf_reference.onnx` (copied from `.local/ctf_reference.onnx`,
served at `/models/ctf_reference.onnx`) — this part is unchanged and correct
(the model is `fetch`ed by ORT, not `import()`ed, so serving it from
`public/` is fine). Implemented `src/engine/inference.ts`
(`evaluatePosition(position): Promise<{ value, policy: Float32Array }>`),
which lazily creates (once, cached) an `InferenceSession` from
`/models/ctf_reference.onnx` via `onnxruntime-web/wasm` (the WASM-only
bundle - no WebGL/WebGPU code pulled in), feeds the input tensor via the
session's `inputNames[0]`, and identifies the value/policy outputs by
element count (1 vs. 1152) exactly as the plan specifies, throwing if
neither is found. Added a temporary, clearly-marked smoke harness -
`src/engine/tempStep3Smoke.ts` (loads the model, builds a fixed starting
position via seeded `autoFill` on both sides, calls `evaluatePosition`, and
logs the session's `inputNames`/`outputNames`, the value, and the policy
length) - wired in via a `import.meta.env.DEV`-guarded dynamic import in
`main.tsx` that exposes `window.ctfStep3Smoke()` for the owner to run from
the browser console. **Left in place** per the step's instructions, for the
owner's manual gate; not yet removed.

**Manual browser verification failed on the first pass, and was fixed
in-step (still Step 3, not a new step).** The original approach self-hosted
onnxruntime-web's WASM runtime by copying `ort-wasm-simd-threaded.{wasm,mjs}`
from `node_modules` into `public/ort/` via a new `scripts/copy-onnx-wasm.mjs`
script wired as the `postinstall` npm script, gitignoring the generated
`public/ort/`, and pointing `ort.env.wasm.wasmPaths` at the string prefix
`"/ort/"`. This **failed at runtime in the browser**: onnxruntime-web
dynamically `import()`s the `.mjs` loader, but Vite forbids importing a file
that lives under `public/` from source code, and its dev server serves that
`.mjs` with an empty/disallowed MIME type — the WASM backend init threw `no
available backend found ... error loading dynamically imported module
.../ort/ort-wasm-simd-threaded.mjs ... blocked because of a disallowed MIME
type`. **The fix:** let Vite own these two files as ordinary bundled assets
instead of self-hosting them. `onnxruntime-web@1.27.0`'s `package.json`
`exports` map exposes `./ort-wasm-simd-threaded.wasm` and
`./ort-wasm-simd-threaded.mjs` as importable subpaths, and
`ort.env.wasm.wasmPaths` accepts an **object** (`{ wasm, mjs }`), not just a
string prefix. `inference.ts` now does
`import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url"`
and the `.mjs` equivalent, and sets
`ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl }` (kept
`numThreads = 1`). Vite resolves these through the package `exports`, serves
them with the correct `text/javascript`/`application/wasm` MIME types in dev
(confirmed by `curl`ing the dev server's resolved URLs directly), and
hashes+copies them into `dist/assets/` on build wherever the import is
actually reachable from the production graph. Removed the now-unneeded
self-hosting machinery: deleted `scripts/copy-onnx-wasm.mjs`, the
`postinstall` script entry in `package.json` (and re-ran `npm install` so
`package-lock.json`'s root `hasInstallScript` flag dropped too), the
generated `public/ort/` directory, and its `.gitignore` entry. No `.d.ts`
was needed for the `?url` imports — the existing
`/// <reference types="vite/client" />` in `src/vite-env.d.ts` already
covers them; `npm run typecheck` was clean without changes there.

**One consequence worth flagging, not a defect:** because
`tempStep3Smoke.ts` is only reachable via the `import.meta.env.DEV`-guarded
dynamic import in `main.tsx`, Vite's production build tree-shakes that whole
branch away, so **today's `npm run build` output does not contain the
`ort-wasm-simd-threaded.{wasm,mjs}` assets** (only `models/ctf_reference.onnx`
lands in `dist/`, alongside the app bundle) — there is nothing in the
production module graph that reaches `inference.ts` yet, by this step's own
design ("do not wire this into any game screen yet"). Verified this is
tree-shaking, not breakage, by temporarily making the smoke import
unconditional and rebuilding: `dist/assets/` then correctly gained hashed
`ort-wasm-simd-threaded-*.mjs` (24 KB) and `-*.wasm` (13.5 MB) files
alongside `models/ctf_reference.onnx`, proving the asset pipeline is wired
correctly end to end. That change was reverted immediately (not part of this
step). The assets will appear in `dist/` for real once Step 4/5 wires
`evaluatePosition` into a production-reachable path.

Verified: `npm run typecheck`, `npm run lint`, and `npm run test` (468
tests, unchanged) are all green; ran `npx prettier --write` on changed files
(already formatted). `npm run build` succeeds; `dist/` currently contains
`models/ctf_reference.onnx` plus the app's JS/CSS bundle (see the
tree-shaking note above for why the WASM assets aren't there yet). Confirmed
via the dev server (`curl`, not a real browser — no headless browser
available in this environment) that the `?url`-resolved `.mjs` and `.wasm`
URLs now serve with `Content-Type: text/javascript` / `application/wasm`
respectively (previously the `.mjs` under `/ort/` served with no/disallowed
MIME type, which was the root cause), and that
`/models/ctf_reference.onnx` still serves HTTP 200. Real in-browser
verification (loading the console harness, watching the Network tab, reading
the logged value/policy) is left for the owner's manual gate, as instructed.
Observed tensor names (captured before this fix, via a throwaway Node-side
check loading the model directly through `onnxruntime-web/wasm`, unaffected
by the WASM-serving fix since that check doesn't go through Vite):
- Input: `board`, shape `(1, 18, 12, 12)`.
- Outputs: `value`, shape `(1, 1)` (1 element); `policy_logits`, shape
  `(1, 8, 12, 12)` (1152 elements).

These match ENG_NN_1 exactly and confirm the element-count-based output
identification in `inference.ts` picks the right tensor in each case.

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

Status: committed

Notes: Created `src/engine/enginePlayer.ts` (`chooseEnginePly(play, evaluate?,
random?)`), the async seam Step 5's play loop will call on the computer's
turn. It takes a `PlayState` directly (per the plan's "given a `PlayState`"
option), extracts the `{ board, sideToMove, inactivityCounter }` triple as a
`Position`, awaits exactly one call to the injectable `PositionEvaluator`
(type `(position: Position) => EngineEvaluation | Promise<EngineEvaluation>`,
defaulting to Step 3's real `evaluatePosition`), and passes the returned
policy straight to Step 2's `selectEnginePly` alongside `play.board`,
`play.sideToMove`, and the injectable `RandomSource` (default `Math.random`).
It never applies the move itself. Added `src/engine/enginePlayer.test.ts`
covering all three required assertions plus two extra checks: (a) a
hand-built all-mass-on-one-ply policy resolves to that exact legal ply; (b)
over 25 ongoing mid-game positions (5 seeded `autoFill` armies x 5 ply-depths,
built by playing random-but-legal plies via `applyMove` independently of the
module under test, filtered to those still `"ongoing"` with a legal ply,
confirmed to cover both sides to move) x 5 pseudo-random fake policies x 5
seeds, the resolved ply is always in the independently recomputed legal set
and both its `from`/`to` squares are on-board; (c) two calls with the same
seeded `RandomSource` and the same fake policy resolve to the same ply. The
two extras: the evaluator is called exactly once per `chooseEnginePly` call
(a counter, guarding the "exactly one evaluation per move" invariant), and an
`async` evaluator that actually awaits a `Promise` works identically to a
sync one. No deviations from the plan. `npm run typecheck`, `npm run lint`,
and `npm run test` are all green (473 tests passing, 5 new); importing
`enginePlayer.ts` (and therefore `inference.ts`, for the default evaluator)
in the Node/vitest test environment worked without touching WASM, since
`onnxruntime-web`'s `InferenceSession.create` is only reached through
`loadSession()`, which no test triggers (all tests pass a fake evaluator).
Ran `npx prettier --write` on both new files.

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

Status: committed

Notes: Added a third `StartScreen.tsx` choice ("Play against the computer",
wired through a new `onPlayAgainstComputer` prop) and a fifth `App.tsx`
screen kind (`"engine"`, mounting the new `EngineGame`), mirroring how
`"play"` mounts `HotSeatGame`. Created `src/board/EngineGame.tsx` - the new
mode's whole loop (side choice, placement for the human's own army only,
Phase 2 play against the computer) - plus `src/board/EngineSideChoice.tsx`
(the "Play as red" / "Play as blue" prompt) and their CSS. Placement reuses
the existing pure `PlacementState` operations (`place`/`move`/`swap`/
`returnToTray`/`clear`/`autoFill`) and the exact `Board`/`Tray`/
`PlacementControls`/`PlacementStatus` components hot-seat uses, driven from a
single `PlacementState` (not the two-player `PlacementSession` wrapper, since
only the human ever places here - the computer's army is generated silently
by `autoFill(emptyPlacement(computerSide))` the instant the human confirms,
never shown before play). `buildInitialGameState`/`startSession` build Phase
2 exactly as hot-seat does. Turn flow reuses `activateSquare`/`PlaySession`
unmodified: on the human's turn `EngineGame` behaves exactly like
`HotSeatGame`'s Phase-2 branch; on the computer's turn, a `useEffect` keyed
on `[playSession, humanSide]` calls Step 4's `chooseEnginePly` (real
inference, `Math.random`, no overrides) and applies the result through a new
`applyEnginePly` helper that drives the *same* `activateSquare` -> `applyMove`
path a human's two clicks would (select `from`, then activate `to`), so the
computer's move gets the same announcements, record entry, and game-end
detection a human's move does. A `cancelled` flag set in the effect's cleanup
guards both React StrictMode's dev-mode double-invocation and a stale move
resolving after the player has left mid-thought (confirming
`LeaveGameDialog` unmounts `EngineGame`, running the cleanup) - the promise
callback checks it before calling any setter. "The computer is thinking" is
modeled as a derived boolean (`playSession.play.result.kind === "ongoing" &&
playSession.play.sideToMove === computerSide`, not a separate piece of
state), continuously true for the whole span from the turn handing to the
computer until its move applies; it drives both a small visual paragraph
("The computer is thinking…", deliberately no live region of its own, to
avoid double-announcing) and a sentence pushed into the board's one existing
live region (`playAnnouncement`, the same channel `describeActivation`'s
ordinary move narrative already uses) at the moment the effect fires, so it
*is* announced, not merely shown, exactly as the step's own text (not just
Step 7's) requires. Board orientation is always the human's own side, never
flipping: extended `PlayBoard.tsx` (not forked - HotSeatGame's own usage is
byte-for-byte unchanged, since the new props default away) with two new
optional props, `side?: Side` (overrides `viewSide`/`flipBetweenTurns`
entirely - needed because `flipBetweenTurns={false}`'s existing "always
white" semantics cannot express "always the human's side" when the human is
playing black) and `disabled?: boolean` (zeroes `destinationSquares`/
`attackSquares`/`activatableSquares` so the human cannot select or move the
computer's own pieces during its turn, even though `playSession.ts`'s own
query functions structurally treat them as "the side-to-move's own movable
pieces" - the same inert pattern the review screen already relies on by
never passing `activatableSquares` at all). No draw-offer control and no
"flip between turns" toggle are rendered (neither is imported). "New game"
(`GameResult`'s shared action) and "Back to start" -> confirm -> re-entering
the mode both reset all the way back to the side-choice phase (`humanSide`
to `null`), giving "fresh side choice, fresh placement, fresh random
computer army" in both cases, not just on a fresh mount.

Deviation from the plan (not a policy change, a wiring correction): the plan
said to reuse `PlayBoard` unmodified; a small, additive, backward-compatible
extension to `PlayBoard.tsx` (the two new optional props above) turned out to
be necessary to satisfy "board orientation is always yours" and "the board
is inert on the computer's turn" without forking it or `playSession.ts` -
`PlayBoard` itself is already documented as "a thin adapter [deriving]
FullBoard's props from a PlaySession," and the review screen already
establishes the precedent of a second, different adapter (composing
`FullBoard` directly) for a second, different orientation/inertness policy;
this instead keeps the one `PlayBoard` adapter but makes its two policy axes
(orientation, inertness) overridable, which seemed less duplicative than a
second bespoke adapter. `npm run typecheck`, `npm run lint`, `npm run test`
(473 tests, unchanged - this step is pure UI wiring with no new pure-logic
module, per the step's own verification list, which is manual), and
`npm run build` are all green; `npm run build`'s `dist/` now contains the
`onnxruntime-web` WASM assets alongside `models/ctf_reference.onnx` for the
first time (Step 3's tree-shaking note predicted this the moment inference
became production-reachable). Ran `npx prettier --write` on all new/changed
files. Confirmed by reading (no browser available in this environment) that
`HotSeatGame.tsx`'s and `ReviewScreen.tsx`'s own code paths are untouched
apart from `PlayBoard.tsx`'s additive props. **This step's own verification
(Gate A, Gate D) is manual and is the owner's to run** (`npm run dev`),
per the task instructions; not performed here.

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
