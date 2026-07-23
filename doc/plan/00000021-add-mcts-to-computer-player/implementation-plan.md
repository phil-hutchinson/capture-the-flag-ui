# Implementation plan — Story 00000021: Give the computer a real search (MCTS)

This plan turns the computer's move choice from a single raw-policy sample
(story 00000019's `chooseEnginePly`) into a genuine PUCT Monte-Carlo tree
search that drives the existing rules engine, consumes the network's value head
as well as its policy head, retains its tree across turns, and offers three
difficulty modes. The search runs inside a **Web Worker** from day one so a
real, heavier reference model can later be plugged in with no structural change.
Read `story.md` in this folder for the full requirement and the fixed policy;
this plan is the working context for implementing it.

## Orienting facts for every step (read once)

These are the modules and seams this story builds on. A step touching any of
them should not need to rediscover this.

- **Rules engine (authoritative, never reimplemented)** —
  `src/rules/primary/v1/`:
  - `movement.ts`: `legalDestinations(board, origin)`, `legalAttacks(board,
    origin)`, `hasAnyLegalPly(board, side)`.
  - `play.ts`: `PlayState` (fields `board`, `sideToMove`, `inactivityCounter`,
    `result`, plus `moves`/`initialBoard`/`ruleset`), `startPlay(initial)`,
    `applyMove(state, from, to)` → `{ state, outcome }` (pure, returns a new
    state; throws on an illegal ply or a finished game). `PlayState` is a plain
    data object (no functions), so it is `postMessage` structured-cloneable.
  - `outcome.ts`: `computeOutcome(board, activeSide, inactivityCounter)` →
    `GameOutcome` (`{ kind: "ongoing" }`, `{ kind: "win", winner, reason }`, or
    `{ kind: "draw", reason }`). `reason` ∈ `flagCapture`, `noLegalMove`,
    `inactivity`, `agreement`. `PlayState.result` already carries the current
    outcome, recomputed by `applyMove`.
- **Policy decode / legal masking** — `src/encoding/eng-nn-1/decoder.ts`:
  `policyIndexForPly(ply, mover)` (flat index into the length-1152 policy for a
  ply, in the mover's frame), `selectEnginePly(policy, board, side, random)`
  (the raw-policy path this story supersedes), `MOVEMENT_OFFSETS`, the `Ply`
  interface (`{ from, to }`), and the `RandomSource` type (`() => number` in
  `[0, 1)`, injectable). A private `enumerateLegalPlies(board, side)` builds the
  legal-ply list by walking `legalDestinations`/`legalAttacks` over every one of
  `side`'s pieces; Step 1 exports it (or an equivalent shared helper) so the
  search masks against the exact same legal set `selectEnginePly` does.
- **Inference boundary** — `src/engine/inference.ts`:
  `evaluatePosition(position)` → `Promise<EngineEvaluation>` where
  `EngineEvaluation = { value: number; policy: Float32Array }`. `value` is a
  scalar in `[-1, 1]` **from the position's side-to-move's perspective**;
  `policy` is the length-1152 logits in the mover's frame. It loads the
  onnxruntime-web WASM session lazily and cached, single-threaded
  (`ort.env.wasm.numThreads = 1`, a static-host constraint), and resolves the
  runtime's `.wasm`/`.mjs` assets through Vite `?url` imports set on
  `ort.env.wasm.wasmPaths`. This module is imported and run **inside the
  worker** (Step 3); it is pure TS + WASM and needs no DOM.
- **The injectable evaluator seam** — `PositionEvaluator`
  (`(position: Position) => EngineEvaluation | Promise<EngineEvaluation>`,
  currently in `src/engine/enginePlayer.ts`; relocate with type-only imports so
  the pure search/driver modules do not runtime-import onnxruntime — see Step 1).
  `Position` is `{ board, sideToMove, inactivityCounter }` (from
  `src/encoding/eng-nn-1/encoder.ts`). This seam and `RandomSource` are what make
  the search unit-testable without WASM and deterministic under test.
- **Play-loop UI** — `src/board/EngineGame.tsx`: the against-the-computer
  screen. Its computer-turn `useEffect` currently calls `chooseEnginePly`,
  guards a superseded/StrictMode-double-invoked result with a `cancelled` flag in
  the effect cleanup, enforces a minimum "thinking" display
  (`MIN_THINKING_DISPLAY_MS`, via `Promise.all` with a timer), and applies the
  move through `applyEnginePly` → `activateSquare` → `applyMove` before starting
  the move-slide overlay (`animatedMove`). The human's own move goes through
  `handlePlayActivate` → `activateSquare`. `handleNewGame` and confirmed-leave
  reset the session.
- **Setup UI** — `src/board/EngineSideChoice.tsx`: rendered while `humanSide`
  is unset; its `onChoose(side)` sets `humanSide` and starts placement.
- **Build/tooling facts** — Vitest's `test.environment` is `node` (no DOM, no
  real `Worker`), so unit tests never instantiate a worker or WASM. There are no
  existing workers in the repo. `tsconfig.app.json`'s `lib` is `["ES2022",
  "DOM", "DOM.Iterable"]` — it does **not** include `WebWorker`, so the worker
  entry module must bring in the worker global types itself (a
  `/// <reference lib="webworker" />` directive, or a dedicated tsconfig
  include). The worker is instantiated with Vite's module-worker form
  `new Worker(new URL("./searchWorker.ts", import.meta.url), { type: "module" })`
  (fixed decision 1), which lets Vite bundle the worker and its dependency graph
  — including onnxruntime-web and the `?url` WASM assets — for both dev and the
  static `dist/` build.
- **Test conventions** — all existing tests are pure-logic Vitest specs.
  Determinism uses a seeded LCG `RandomSource` (see
  `src/engine/enginePlayer.test.ts`, `src/rules/primary/v1/placement.test.ts`).
  Positions are built from seeded `autoFill` armies
  (`src/rules/primary/v1/placement.ts`) plus a few rules-engine-legal plies.
  Reuse these patterns.
- **Green bar at every commit** — `npm run typecheck`, `npm run lint`, and
  `npm test` must all pass before each step is committed, in addition to the
  step's own verification.

## Fixed design decisions (resolving the story's "open items at plan time")

Decided here so no step re-litigates them. Any step may rely on them.

1. **The search runs inside a Web Worker, from day one** (owner decision,
   overriding an earlier main-thread choice). The rationale is structural: a
   real, heavier reference model must plug in with **no** architectural change,
   so the worker boundary exists now. The worker is instantiated with
   `new Worker(new URL("./searchWorker.ts", import.meta.url), { type: "module" })`.
   The main thread never runs the search or the inference; the async move
   boundary in `EngineGame.tsx` stays a `Promise`, now backed by `postMessage`
   round-trips.
2. **The worker owns the onnxruntime session, the search, AND the retained
   tree.** The tree never crosses the message boundary — serializing it every
   move would defeat retention. Only small structured-cloneable messages cross:
   positions (`PlayState`), plies (`{ from, to }`), the difficulty config, and
   control signals. The main-thread "driver" is a thin **proxy client** that
   posts messages and awaits the chosen ply.
3. **The search and the retention/budget-cap logic stay PURE modules**
   (`src/engine/search.ts`, `src/engine/searchDriver.ts`), imported directly by
   Vitest with a fake evaluator — never through the worker. The worker
   (`searchWorker.ts`) and the proxy (`searchClient.ts`) are thin hosts around
   them. What the worker/proxy add — the `postMessage` protocol and asset
   loading — is not unit-testable in the `node` test environment and is covered
   by the manual gates (Steps 3, 5, 6).
4. **Double-cap counting: root visit count.** "Simulations backing the root" is
   the root node's visit count. Given a retained root carrying `R` visits and a
   mode budget `B`, the driver runs `min(B, max(0, 2·B − R))` new iterations, so
   after search the root holds between `B` and `2·B` visits and never more.
5. **PUCT constants, fixed in the config object:** exploration constant
   `c_puct = 1.5`; **no Dirichlet root noise** (the zero-weight model needs none
   and determinism is preferred). They live in the config so a later story can
   tune them without reshaping the search.
6. **Prior source is a config seam, but only the policy-head prior is built.**
   The search derives child priors through a single replaceable prior function;
   this story wires only the policy-head decode (softmax over the legal plies'
   logits via `policyIndexForPly`). The uniform/blended prior a stale-model story
   will want is left as a seam, not implemented.
7. **Difficulty control: three plainly-labelled buttons — "Easy", "Medium",
   "Hard"** — on the same setup screen as the side choice, with **Medium**
   preselected. The iteration numbers (500 / 2000 / 7500) are not surfaced. The
   config (budget + `2·B` cap) is sent to the worker when the game's worker is
   created.
8. **"Commit only on confirm" across the message boundary.** A `choose` message
   makes the worker search over a **working tree cloned from its retained root**
   and reply with the chosen ply; the worker does **not** advance (descend) its
   retained tree yet. Only a subsequent `commit` message (carrying the applied
   ply), sent by the main thread **after** its `cancelled` guard has passed and
   the move has been applied, makes the worker adopt the working tree and descend
   the root into that ply. A cancelled/superseded/StrictMode-doubled turn sends
   no `commit`, so the worker's retained tree is never advanced by a turn the UI
   discarded; a later `choose` or `reset` simply drops the stale working tree.
   The human's reply is an `observe(ply)` message: the worker descends its
   retained root into the matching child, or discards the tree if that ply was
   unexplored (fresh start next move).
9. **Fresh tree guarantees via worker lifecycle.** A `reset` message clears the
   worker's retained tree (and any pending working tree) for "New game," keeping
   the session warm. On the component unmounting (confirmed-leave) the proxy
   calls `worker.terminate()`, abandoning any in-flight search and destroying the
   tree outright. Either way a fresh game never inherits a tree.
10. **`chooseEnginePly` is replaced, not extended.** The proxy client becomes the
    seam the play loop calls; the raw-policy `chooseEnginePly` and its test are
    removed once `EngineGame.tsx` stops using them (Step 5). The
    `PositionEvaluator` type stays exported (relocated per Step 1) because the
    search, driver, and worker reuse it.

---

## Step 1 — Pure PUCT search core

Status: committed

Notes: Implemented `src/engine/search.ts` (tree node/edge types, `expand`,
PUCT `selectEdge`, sign-flipped `backpropagate`, `runIteration`/`runSearch`,
`mostVisitedPly`) and `src/engine/search.test.ts` covering all four
verification scenarios (a)-(d); relocated `PositionEvaluator` here (type-only
`EngineEvaluation` import) and re-exported it from `enginePlayer.ts`, and
exported `enumerateLegalPlies` from `decoder.ts` for the search to reuse, per
fixed decision 10 and the step's text. Deviation: test (d) ("an all-mass-on-
one-ply fake policy makes that ply dominate the root's visits") originally
used a board with a nearby mobile Black piece; the search legitimately
discovered a real tactical downside a few plies after the favored move (the
White piece could be captured, leading to a `noLegalMove` loss) and
correctly de-prioritized it despite the overwhelming prior, causing more even
visit distribution among root children - correct PUCT behavior, but it
contaminated this test's intent of isolating the prior's effect. Rewrote the
test's board so Black has only its immobile Flag (no mobile piece at all):
every White reply then leads to the identical immediate `noLegalMove` win one
ply later, keeping every root edge's true backed-up value uniform so the
measured visit distribution reflects only the prior. Also ran `npx prettier
--write` on the two touched files to match the repo's formatting (not run by
`npm run lint`, but part of repo convention).

Implement a new pure module (`src/engine/search.ts`) that runs a PUCT
Monte-Carlo tree search over the rules engine for a single position, given a
budget of iterations to run. No worker, no DOM, no onnxruntime import at runtime
(use `import type` for `EngineEvaluation`/`Position`; the evaluator is injected).

- **Tree shape.** A node holds a `PlayState` (its position), and — once
  expanded — an edge per legal ply from that position, each edge carrying its
  child node (lazily created), its prior probability, its visit count, and its
  accumulated value. Edges are the plies enumerated from the rules engine
  (Orienting facts), so every edge is a legal ply and every child `PlayState`
  comes from `applyMove`. The search never enumerates or applies a move itself
  beyond calling the rules engine.
- **One iteration:** select a path from the root down by the PUCT rule (child
  score = mean value + `c_puct · prior · sqrt(parentVisits) / (1 +
  childVisits)`) until reaching an unexpanded or terminal node; expand it; then
  back-propagate a value up the path.
- **Expansion / leaf value.** On first reaching an unexpanded, non-terminal
  node, call the injected `PositionEvaluator` on its `Position`. Use the returned
  `value` as the leaf's backed-up value (it is already from that node's
  side-to-move's perspective) and the returned `policy` — softmaxed over that
  node's legal plies via `policyIndexForPly`, reusing the shared legal-ply
  enumeration — as its children's priors.
- **Terminal nodes.** A node whose `PlayState.result.kind !== "ongoing"` is
  never expanded and never evaluated; it back-propagates its true game result
  from *its own* side-to-move's perspective: a loss for the side to move
  (`noLegalMove`, or a `flagCapture` win for the opponent) is `−1`, a win for
  the side to move is `+1`, a draw (`inactivity`) is `0`.
- **Perspective sign-flipping on back-propagation.** The backed-up value is from
  the leaf's mover's perspective; flip its sign at each step up the path so every
  node accumulates value from its own side-to-move's perspective.
- **Config object** (`c_puct = 1.5`, no Dirichlet noise per fixed decision 5),
  an injected `PositionEvaluator` (required — no default that would import
  onnxruntime), and an injected `RandomSource` for tie-breaking. Keep the search
  pure over the root it is handed: no clock, no bare `Math.random`, no
  module-level mutable state.
- **Entry point.** An async function that, given a root node and a number of
  iterations, runs that many iterations (awaiting the async evaluator each
  iteration) and returns the mutated root, plus a helper that reads off the
  **most-visited root child** (ties broken by the injected `RandomSource`) as the
  chosen ply. No cooperative main-thread yielding is needed — the search runs off
  the main thread in the worker (Step 3), and awaiting the async evaluator each
  iteration already turns the worker's event loop.
- Relocate the `PositionEvaluator` type here (or a shared types module) using
  type-only imports, and export the shared legal-ply enumeration from
  `decoder.ts` (or a small shared helper) so both `selectEnginePly` and this
  module use it; keep `decoder.ts`'s existing tests green.

Depends on: nothing new (builds only on the rules engine, decoder, and the
inference *types* that already exist).

Why here: it is the pure, dependency-free heart of the story; the driver
(Step 2), the worker (Step 3), and ultimately the play loop all rest on it, so
it must exist and be proven correct first.

Verification (automated): Add `src/engine/search.test.ts` using the fake-
evaluator + seeded-`RandomSource` pattern. Run `npm test` and confirm:
(a) over many seeded `autoFill` mid-game positions, both sides to move, every
edge the search expands and the chosen most-visited ply is in the rules engine's
legal set and on-board; (b) on a hand-built position with a forced flag-capture
win available within a small iteration budget under a flat (all-zero) evaluator,
the search's most-visited root child is the winning move, and the mirror position
(a forced loss) back-propagates `−1`; (c) the chosen ply and the tree are
deterministic and reproducible given a fixed fake evaluator and fixed seed, with
ties broken by the injected random source; (d) an all-mass-on-one-ply fake policy
makes that ply dominate the root's visits. Also run `npm run typecheck` and
`npm run lint`.

---

## Step 2 — Pure stateful driver: tree retention and the budget/cap

Status: committed

Notes: Implemented `src/engine/searchDriver.ts` (`SearchDriver` class owning
`retainedRoot`/`pendingRoot`, `choose`/`commit`/`observe`/`reset`, plus
`getRetainedRoot`/`getPendingRoot` inspection accessors added for testability)
and `src/engine/searchDriver.test.ts` covering all four verification scenarios
(a)-(d), per fixed decisions 4 and 8. `choose` reconciles the retained root
against the caller's `PlayState` by value (a `statesMatch` helper comparing
side-to-move, inactivity counter, and every board square) rather than by
reference, since the retained root's state comes from the search's own
`applyMove` descent, not the caller's; `cloneTree` deep-clones the retained
root (sharing immutable `PlayState` references) into a private working tree
before every search, so an uncommitted `choose` never mutates what is
retained. No deviations from the plan's text. Also ran `npx prettier --write`
on both new files to match repo formatting convention (as Step 1 did).

Implement a pure stateful driver (`src/engine/searchDriver.ts`) that owns a
retained tree across turns and applies the budget/cap, built on Step 1's pure
search. It is a plain module (a class or closure-backed object) with no worker
and no DOM, so it is unit-tested directly; the worker (Step 3) hosts an instance
of it.

- **Construction** takes the search config including the mode's iteration budget
  `B` and the derived cap `2·B`, plus the injected `PositionEvaluator` and
  `RandomSource`. It starts with no retained root.
- **Choosing the computer's move**, given the current `PlayState` (computer to
  move): reconcile the retained root against the current position — reuse it if
  it already corresponds to this position (the normal case, because the driver
  descends on commit/observe), otherwise build a fresh single-node root from the
  current `PlayState`. Clone that root into a **private working tree** so search
  never mutates the stored root (fixed decision 8). Compute new iterations
  `min(B, max(0, 2·B − R))` where `R` is the retained root's visit count (fixed
  decision 4), run Step 1's search for that many iterations over the working
  tree, read off the most-visited child as the chosen ply, and hold the working
  tree as **pending** (not yet adopted). Return the chosen ply. After a fresh
  start `R = 0` so a full budget `B` runs; after a fully-predicted retention the
  root already holds up to `2·B` and 0 new iterations run — capped at `2·B`,
  never exceeding it.
- **Commit.** A separate call (given the applied ply) adopts the pending working
  tree as the retained root and descends it into that ply's child (keeping that
  subtree, discarding siblings). Only this call advances the retained tree.
- **Observe the opponent's (human's) ply.** Descend the retained root into the
  child matching the human's ply, keeping that subtree and discarding siblings;
  if the human's ply is absent from the retained tree, discard the tree entirely
  so the next move starts fresh.
- **Reset.** Drop the retained tree and any pending working tree.
- Keep the raw-policy `chooseEnginePly` in place for now (still used by
  `EngineGame.tsx` until Step 5); do not remove it in this step.

Depends on: Step 1 (calls the pure search, reads its most-visited child, reuses
its node/tree types).

Why here: retention, the budget/cap arithmetic, and descent are the driver's
job, kept out of the pure search so both stay testable; the worker (Step 3) needs
this driver to exist before it can host it.

Verification (automated): Add `src/engine/searchDriver.test.ts` with a fake
evaluator and seeded random. Run `npm test` and confirm: (a) choose → commit a
move, then observe that same ply as the opponent's reply, and the retained root's
visit count carries forward (is not reset to 0) with the kept subtree the matching
child and siblings gone; (b) observing an opponent ply the retained tree never
expanded resets to an empty tree, and the next move then runs a full budget `B`;
(c) the budget/cap arithmetic holds — a fresh root runs `B` iterations, and across
consecutive fully-predicted moves the root visit count grows turn over turn but is
clamped to `[B, 2·B]` and never exceeds `2·B`; (d) a `choose` whose result is
never committed leaves the retained root and its visit count unchanged (pending
tree dropped). Also run `npm run typecheck` and `npm run lint`.

---

## Step 3 — Worker host and main-thread proxy client

Status: pending

Introduce the Web Worker that hosts the driver and the onnxruntime session, and
the thin main-thread proxy client that talks to it — the plumbing that lets the
search run off the main thread with the retained tree living in the worker.

- **Worker entry** (`src/engine/searchWorker.ts`): declares the worker global
  types (`/// <reference lib="webworker" />` or a dedicated tsconfig include, per
  Orienting facts), constructs one Step 2 driver wired with `evaluatePosition`
  (`src/engine/inference.ts`, imported and run here — WASM lives in the worker),
  and handles the message protocol: an `init`/config message carrying the
  difficulty's budget `B` and cap `2·B`; `choose(position)` → runs the driver's
  choose and posts back the chosen ply (with a request id so the proxy can match
  replies); `commit(ply)` → driver commit/descend; `observe(ply)` → driver
  observe; `reset` → driver reset (keeps the session warm). All payloads are
  structured-cloneable (`PlayState`, `{ from, to }`, numbers).
- **Proxy client** (`src/engine/searchClient.ts`): a small main-thread class
  that owns the `Worker` instance (created via the Vite module-worker form,
  fixed decision 1), sends the config, exposes an **async** `choosePly(position)`
  returning a `Promise<Ply>` (resolved when the matching reply arrives, matched
  by request id), and fire-and-forget `commit(ply)`, `observe(ply)`, and `reset()`
  methods, plus a `terminate()` that calls `worker.terminate()` (fixed decision
  9). It surfaces a worker error (e.g. WASM failed to load) as a rejected
  `choosePly` promise, so the play loop's existing `.catch` can show the
  "computer could not make a move" message rather than hanging.
- Confirm the onnxruntime-web WASM/`.mjs` assets load inside the worker under the
  project's Vite setup and the single-threaded static-host constraint: the
  worker's dependency graph pulls in `inference.ts`, whose `?url` asset imports
  and `ort.env.wasm.wasmPaths` must resolve to the worker-bundle's emitted asset
  URLs in both `npm run dev` and the `npm run build` output. `numThreads = 1`
  already avoids the cross-origin-isolation requirement. Nothing self-hosted
  under `public/` — Vite resolves and hashes the assets.
- Do not wire the proxy into `EngineGame.tsx` yet (that is Step 5); this step
  delivers and proves the worker boundary on its own.

Depends on: Step 2 (the worker hosts a driver instance) and, through it, Step 1;
`src/engine/inference.ts` (run inside the worker).

Why here: the worker/proxy plumbing is scaffolding, separated from both the pure
search logic (Steps 1–2) and the UI wiring (Step 5) so its one hard-to-test
concern — that WASM loads and a round-trip works in a real worker — is verified
in isolation before the play loop depends on it.

Verification (manual, improvised harness): Because the `node` test environment
has no real `Worker` or WASM, add a temporary throwaway harness to the running
app (e.g. a dev-only button or a one-off call in `EngineGame`/`App`) that
constructs the proxy client and posts a `choose` for the opening `PlayState` at a
small budget. Run `npm run dev`, trigger it, and confirm the browser console/UI
shows: the worker loads onnxruntime with no errors, and a legal, on-board ply
comes back from the round-trip; a second `choose`/`commit`/`observe` sequence
runs without error. Then remove the temporary harness before committing. Also
run `npm run typecheck`, `npm run lint`, and `npm test` (the pure suites stay
green; the worker/proxy have no unit tests).

---

## Step 4 — Difficulty selection on the setup screen

Status: pending

Add the easy/medium/hard difficulty choice to the against-the-computer setup
screen, threading the chosen difficulty into `EngineGame.tsx`'s state without yet
changing how the move is computed.

- **Wording and placement (fixed decision 7):** three plainly-labelled buttons —
  "Easy", "Medium", "Hard" — on the same setup screen as the side choice
  (`EngineSideChoice.tsx`), with **Medium** preselected. Iteration numbers are
  not shown.
- Define the three modes and their iteration budgets (Easy 500, Medium 2000,
  Hard 7500) and derived caps (1000 / 4000 / 15000) in one place (e.g. a small
  `src/engine/difficulty.ts` module), so Step 5 reads the config that the worker
  is initialised with from a single source.
- Extend the setup screen so choosing a side reports both the side and the
  selected difficulty; `EngineGame.tsx` stores the chosen difficulty in state
  alongside `humanSide` and carries it through placement. Nothing consumes it yet
  — the move is still computed by `chooseEnginePly` (wiring is Step 5) — so the
  app stays green and playable.
- Player-facing text stays in the mode's tone: "the computer", side colors,
  "move" not "ply". Keep the existing "Back to start" behavior on this screen.

Depends on: nothing from Steps 1–3 at runtime (it only stores a value); sequenced
before Step 5, which needs the stored difficulty to configure the worker. Reuses
the mode/budget constants introduced here.

Why here: the setup UI is independent of the search internals and can be verified
on its own, keeping the wiring step focused on the play loop.

Verification (manual — Gate A): Run `npm run dev`, choose "Play against the
computer", and confirm the setup screen offers Easy / Medium / Hard alongside the
side choice with Medium preselected; selecting a difficulty and a side enters
placement; "Back to start" returns to the start screen; starting again lets you
pick a different difficulty. (That the game then *plays* with that difficulty is
verified once the worker-backed proxy is wired — Steps 5–6.) Also run
`npm run typecheck`, `npm run lint`, and `npm test`.

---

## Step 5 — Wire the worker-backed proxy into the play loop

Status: pending

Replace `EngineGame.tsx`'s raw-policy computer move with the proxy client from
Step 3, configured with Step 4's chosen difficulty, preserving every existing
guard and the move-slide.

- Hold the proxy client in a `useRef`. Create it (and its worker) when play
  begins, sending the config for the difficulty chosen in Step 4. Call the
  proxy's `reset()` on `handleNewGame` (clears the worker's retained tree, keeps
  the session warm) and `terminate()` on the component's unmount/confirmed-leave
  cleanup, so a fresh game never inherits a tree (fixed decision 9).
- In the computer-turn effect, call `proxy.choosePly(position)` instead of
  `chooseEnginePly` (still inside the existing `Promise.all` with the
  minimum-thinking timer, so the "thinking" state and its guards are unchanged).
  Only after the existing `cancelled` check passes: apply the chosen ply through
  the same `applyEnginePly` → `activateSquare` → `applyMove` path, start the same
  move-slide overlay, and post `proxy.commit(ply)` so the worker descends its
  retained tree into the move just played. A cancelled / superseded /
  StrictMode-double-invoked turn must apply nothing **and** send no `commit`, so
  the worker's retained tree is never advanced by a discarded turn (fixed
  decision 8). The proxy's `choosePly` rejection path keeps the existing `.catch`
  "the computer could not make a move" behavior.
- When the human completes a move (`handlePlayActivate`, after the move is
  applied), post `proxy.observe(humanPly)` so the worker descends its retained
  tree (or discards it if the ply was unexplored).
- Remove the now-unused raw-policy `chooseEnginePly` and its test
  (`src/engine/enginePlayer.test.ts`); keep the `PositionEvaluator` type export
  (relocated in Step 1) that the search/driver/worker rely on (fixed decision
  10). Do not otherwise change the side choice, `autoFill` computer army, board
  orientation, endings, record, leave/new-game flow, or player-facing text.

Depends on: Step 3 (the proxy client and worker) and Step 4 (the stored
difficulty and mode constants); through them, Steps 1–2.

Why here: this is the behavioral heart — the computer now actually searches, off
the main thread. It comes after the worker boundary and the difficulty are in
place, and before the responsiveness and accessibility polish that build on a
working loop.

Verification (manual — Gates B, D, E): Run `npm run dev` and play against the
computer. Confirm: (Gate B) at each of Easy / Medium / Hard you can play a
complete game; on the computer's turn the "thinking" state shows, the board is
inert, and the computer makes exactly one legal move — plain, two-square
unencumbered, or an attack with the correct removals — and never an illegal or
off-board move, including near the flag and against Towers. (Gate D) Flag capture
in either direction, a no-legal-move loss, and the 50-move inactivity draw each
end the game with the right winner named by color, at every difficulty, with no
draw-offer control. (Gate E) Leaving mid-game warns and, on confirm, returns to
start (the worker is terminated); "New game" begins cleanly with a fresh side,
difficulty, placement, random computer army, and no retained tree from the
previous game. Also run `npm run typecheck`, `npm run lint`, and `npm test`
(the search/driver suites plus the rest; confirm the removed `chooseEnginePly`
test leaves the suite green).

---

## Step 6 — Confirm the main thread stays free and live tree reuse holds

Status: pending

Confirm that offloading the search to the worker keeps the main thread
responsive at the hardest setting, and that live tree reuse across expected and
unexpected replies behaves.

- With the search in the worker, the main thread does no per-iteration work, so
  the UI should stay smooth even while up to 7500 evaluations run on hard (the
  double cap only ever *reduces* new evaluations, so 7500 is the ceiling per
  move). Confirm this holds in practice — the page stays interactive and the
  "thinking" indicator animates through a genuine wait — rather than tuning any
  main-thread cadence (there is none to tune now).
- No new infrastructure is expected here — the worker offload exists from Steps
  3 and 5; this step is the runtime observation of Gate C on the wired loop.

Depends on: Step 5 (a working, worker-backed play loop to observe under load).

Why here: responsiveness and live reuse can only be judged on the real, wired
loop at the real budget, and it is a distinct manual observation from Step 5's
legality/endings gates.

Verification (manual — Gate C): Run `npm run dev` in Hard mode (7500 / cap 15000)
and confirm the UI does not freeze while the computer thinks — the page stays
responsive (scroll, focus, indicator animation all smooth) and the "thinking"
indicator behaves through the wait. Play a line the computer "expected" (a reply
already in its retained tree) and one it did not; both continue cleanly with no
stalls, no stuck board, and no doubled moves. Also run `npm run typecheck`,
`npm run lint`, and `npm test`.

---

## Step 7 — Accessibility polish

Status: pending

Extend story 00000019's accessibility patterns to cover the new difficulty choice
and the now-genuine "thinking" wait, without replacing what already works.

- The difficulty control is keyboard-operable and announced by a screen reader
  (labelled group, clear selected state, visible focus), consistent with the
  existing side-choice controls.
- The "thinking" state — now a real, worker-backed wait rather than a cosmetic
  minimum — is announced once through the board's existing polite live region
  (the same `playAnnouncement` seam), each computer move and the result are
  announced, and focus stays visible and untrapped through a computer turn. Do
  not introduce a second live region that would double-speak (see
  `EngineGame.tsx`'s existing comments on the single live region).

Depends on: Step 4 (the difficulty control exists) and Steps 5–6 (the real
thinking wait and computer moves exist to announce).

Why here: accessibility is verified last, once every new surface (the control,
the wait, the moves, the result) is present and behaving.

Verification (manual — Gate F): Run `npm run dev`. With the mouse away, play a
full game at each difficulty entirely by keyboard. With a screen reader on,
confirm the difficulty choice, the "thinking" state, each computer move, and the
result are announced, and that focus stays visible and is never trapped. Also run
`npm run typecheck`, `npm run lint`, and `npm test`.

---

## Step 8 — README accuracy check

Status: pending

Review `README.md` against this story's changes and update it if warranted, or
confirm no update is needed. The against-the-computer section (around lines
39–46) currently says the computer "just moves at random"; with a real search
(still over a zero-weight model, so still ~random play) and a new difficulty
choice, decide whether the player-facing description and the difficulty modes
should be mentioned, keeping the text non-technical and honest that strength
arrives with trained weights. Do not restate the rules or reference trademarked
products.

Depends on: Steps 4–7 (the player-visible changes — difficulty modes and the
real thinking wait — are what the README might need to reflect).

Why here: the README is checked once, after all player-visible behavior is final,
per the plan guide's required README step.

Verification (manual): Run `/update-readme` (or review the branch diff against
`README.md` by hand) and confirm `README.md` accurately describes the
against-the-computer mode and the difficulty choice, with no stale "moves at
random with no difficulty" claims. Also run `npm run typecheck`, `npm run lint`,
and `npm test` to confirm the branch is green.
