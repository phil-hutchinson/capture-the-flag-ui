# Story 00000021 — Give the computer a real search (MCTS)

## Summary

Story 00000019 laid the whole board-to-network-to-move path but stops at the
shallowest possible use of it: on the computer's turn it runs **one** network
evaluation and picks its move straight from the policy over the legal plies
(`chooseEnginePly` → `selectEnginePly`). It never looks ahead. This story
replaces that with a genuine **Monte-Carlo tree search** (PUCT) that drives the
existing rules engine forward, using the network's **value** head (produced
but deliberately unused since story 00000019) as well as its policy head, so
the computer actually reasons about replies and follow-ups instead of playing
the first thing the policy likes.

Two things beyond "just add a search loop" define this story:

1. **The search tree is kept between turns.** When the computer moves, and
   again when the human replies, the search descends into the chosen branch
   and **keeps that subtree** as the root for next time, discarding the
   siblings — rather than throwing the whole tree away and starting from
   scratch every move. Work spent anticipating a reply is not wasted when that
   reply actually happens.
2. **Three difficulty modes**, chosen at setup — **easy (500)**, **medium
   (2000)**, **hard (7500)** — set how many search iterations the computer runs
   per move.

As with story 00000019, this is **machinery, not strength**: we still ship the
zero-weight reference model, so every value is ≈0 and every prior ≈uniform, and
even 7500 iterations of search over a flat evaluation still plays ≈randomly.
That is expected and accepted. The deliverable is a correct, tree-reusing PUCT
search wired into the play loop; real playing strength arrives with real
trained weights and the model manifest (still the follow-up). Nothing here
should need redoing when the weights become real.

## Background & references

- **Story 00000019** (`doc/plan/00000019-add-ability-to-play-against-engine/`)
  is the foundation this builds on. It established: the ENG_NN_1 encoder
  (`src/encoding/eng-nn-1/encoder.ts`), in-browser inference
  (`src/engine/inference.ts`, returning **both** a value scalar and the
  policy logits — the value already noted "retained for the follow-up's tree
  search"), the policy decode/legal-mask (`src/encoding/eng-nn-1/decoder.ts`),
  the async move seam (`chooseEnginePly` in `src/engine/enginePlayer.ts`), and
  the against-the-computer game screen (`src/board/EngineGame.tsx`). This story
  changes **how the next move is chosen**; it reuses everything else.
- **The design notes** in `.local/browser-ai-notes.md` (pre-story, not
  committed work) already anticipate this story: "the PUCT search loop is
  reimplemented in TypeScript, driving the existing rules engine for legal-ply
  generation, state transition, and terminal detection", search settings "in a
  config object from day one" (prior source/blend, simulation count,
  exploration constant, temperature), the observation that "UCT with
  value-head leaf evaluation is just PUCT with a uniform prior" (one search
  implementation, prior source as a parameter), and simulation count as "the
  best-behaved strength knob… degrades smoothly down to 1-sim raw-policy play."
  This story implements the search engine (notes' story split item 2) but
  **not** the model manifest, compatibility states, or checkpoint/temperature
  difficulty (still item 1's manifest and item 3's presets — see Out of scope).
- **The engine's tensor contract** is ENG_NN_1 in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository (`doc/neuralnetwork/eng-nn-1.md`): the value head is a scalar in
  `[−1, 1]` **from the side-to-move's perspective**, and the policy head is
  `(8, 12, 12)` logits in the mover's frame. Both are already produced by
  `evaluatePosition`; this story is the first to consume the value head.
- **The rules engine remains authoritative.** `src/rules/primary/v1/` supplies
  legal plies (`legalDestinations`, `legalAttacks`), the pure state transition
  (`applyMove` in `play.ts`), and terminal detection (`computeOutcome` in
  `outcome.ts`, distinguishing flag-capture win/loss, no-legal-move loss, and
  the inactivity draw). The search **drives** these — every tree edge is a ply
  the engine called legal, every node's state comes from `applyMove`, and every
  terminal is `computeOutcome`. The network only ranks and evaluates; it never
  invents a move or a game result.

## Policy (fixed by the owner, 2026-07-22)

- **Real tree search replaces raw policy.** On the computer's turn it runs a
  PUCT Monte-Carlo tree search: from the current position it repeatedly selects
  a leaf by the PUCT rule (prior from the network's policy head, value from the
  network's value head at newly expanded leaves), expands it with the engine's
  legal plies, and back-propagates the value. Terminal nodes
  (`computeOutcome` ≠ ongoing) are not expanded and back-propagate their true
  game result (+1 win / −1 loss / 0 draw, from the mover's perspective). The
  chosen move is the search's answer, not a single policy sample.
- **The tree is retained across both players' moves.** After the computer plays
  its chosen move, the search keeps the subtree rooted at that move. When the
  human then replies, the search **descends into the child matching the human's
  ply and keeps that subtree** as the new root, discarding the siblings. Only
  when the human plays a ply the retained tree never expanded (possible,
  especially at low iteration counts) does the search **start fresh** from the
  resulting position with an empty tree. The tree never survives leaving the
  game or starting a new one — a fresh game always starts with no tree.
- **Three difficulty modes, chosen at setup.** Before placement (alongside the
  side choice) the player picks **easy**, **medium**, or **hard**, which set
  the per-move iteration count to **500 / 2000 / 7500** respectively. Iteration
  count is the **only** difficulty axis this story — no separate temperature,
  checkpoint, or model per level (there is only the one reference model).
- **Run the full iteration budget every move, but cap the accumulated tree at
  double.** Each move the computer runs its mode's full iteration count (500 /
  2000 / 7500) of _new_ simulations, **regardless of how much retained subtree
  it inherited**. Because retention carries visits forward, consecutive moves
  that both sides "predicted" (plies already explored in the retained tree)
  make the root's accumulated simulation count grow turn over turn. To bound
  this, the total simulation count backing the root is **capped at double the
  mode's budget — 1000 / 4000 / 15000**. Concretely: if the retained root
  already carries `R` simulations, run `min(budget, max(0, 2·budget − R))` new
  ones, so after search the root holds between `budget` and `2·budget`
  simulations and never more. (Whether "simulations" is counted as root visit
  count or as node count is a presentation detail for plan time; the intent —
  full budget each move, hard cap at 2× — is fixed.)
- **The chosen move is the search's most-visited root child.** The computer
  plays the root move with the highest visit count (ties broken by the
  injectable random source). No temperature / visit-count sampling this story
  — that knob is a follow-up (see the design notes' difficulty section).
- **Still one model, one ruleset, hardcoded.** Same as story 00000019: ruleset
  `1.2:PRE-RELEASE`, the single bundled zero-weight reference model, no
  manifest, no compatibility checks, no model selection. The search consumes
  the value head that model already emits.
- **Strength is not the deliverable.** With the zero-weight model the search
  explores an essentially flat tree and the computer still plays ≈randomly.
  That is expected and accepted, exactly as in story 00000019. Correctness of
  the search — legality, terminal handling, tree reuse, and the iteration/cap
  behaviour — is what this story delivers and verifies.
- **Everything else about the mode is unchanged.** Side choice, random
  `autoFill` computer army, board always drawn from the human's perspective,
  no draw offers, the same endings, the same "the computer is thinking"
  treatment, the same move-slide animation, the same leave/new-game flow, and
  the same player-facing vocabulary ("the computer", side colors, rules' piece
  names, "move" not "ply"). This story touches only how the move is _computed_
  and adds the difficulty choice at setup.

## In scope

1. **A PUCT search engine** (new, in `src/engine/`), pure and testable, driving
   the rules engine: node = a `PlayState`; edges = legal plies from
   `legalDestinations`/`legalAttacks`; expansion via `applyMove`; terminal
   detection via `computeOutcome`. Prior comes from the policy head (decoded
   and legal-masked, reusing the decoder's existing mapping), leaf value from
   the value head, with correct perspective sign-flipping on back-propagation.
   Takes a **config object** (iteration budget, exploration constant, and the
   double cap) and an **injectable evaluator** (the same `PositionEvaluator`
   seam story 00000019 uses, so tests run without WASM) and an **injectable
   random source** (tie-breaking), so a search is fully deterministic given a
   fixed evaluator and random source.
2. **A stateful search driver** that owns the retained tree across turns and
   exposes the computer's next move. This supersedes the current stateless
   `chooseEnginePly` (`src/engine/enginePlayer.ts`): the driver must persist a
   root between calls, descend it on the computer's own move and on the human's
   reply, discard siblings, and start fresh when the human's ply is absent from
   the retained tree.
3. **The iteration budget and the double cap**, applied per the policy above:
   full budget of new simulations each move, root simulation count clamped to
   `2·budget`.
4. **Difficulty selection at setup.** The setup screen (currently
   `EngineSideChoice`) gains an easy/medium/hard choice that sets the mode's
   iteration budget for the game. Player-facing labels name the modes plainly;
   the numbers themselves need not be surfaced (a plan-time wording call).
5. **Wiring into the play loop** (`EngineGame.tsx`): the computer-turn effect
   calls the stateful driver instead of `chooseEnginePly`; the driver is
   held for the life of the game and advanced on each ply (computer and human);
   it is discarded on new-game / leave. The existing async boundary,
   `cancelled`/StrictMode guards, minimum "thinking" duration, and move-slide
   animation are preserved — the search resolving a move is still one guarded
   async result applied through the same `applyMove` path.
6. **Keeping the UI responsive** while the search runs its per-move budget of
   new evaluations — **at most 7500** (hard mode's iteration count; each
   iteration evaluates one newly expanded leaf). The double cap never raises
   this: it only **reduces** the number of new simulations when the retained
   tree is already large, so 7500 is the ceiling on evaluations per move.
   Story 00000019 could run inference on the main thread because it was one
   evaluation; thousands is not obviously safe there. The right execution model
   (main thread with yielding, or a Web Worker) is an open item below, but the
   mode must stay responsive and the "computer is thinking" state — now a real
   wait, not a cosmetic minimum — must behave.
7. **Tests.** Deterministic unit tests for the search (only-legal moves ever
   chosen; terminal values back-propagated correctly, including a forced
   flag-capture win found within budget on a hand-built position; most-visited
   selection; subtree reuse on descent; fresh start when the human's ply is
   unexplored; the budget/cap arithmetic). These rest on the same fake-evaluator
   pattern story 00000019 established, plus the standing invariant that the
   computer only ever plays a move the rules engine calls legal.
8. **The app stays green at every commit**, per the standard pipeline
   (typecheck, lint, tests, plus each step's own verification), and a game
   against the computer at all three difficulties is playable by the end.

## Design decisions & constraints

- **One search implementation, prior as a parameter.** Per the design notes,
  build a single PUCT search whose prior source is configurable; value-head
  leaf evaluation with a uniform prior is the same code path. This story only
  needs the policy-head prior, but the seam should not preclude the uniform /
  blended prior the stale-model story will want.
- **The rules engine is never reimplemented.** Legal plies, transitions, and
  terminals come only from `src/rules/primary/v1/`. This is what keeps a
  zero-weight (or, later, a stale) model from ever backing an illegal move or a
  wrong game result, and it is why the search can trust `applyMove` states as
  tree nodes without its own rules logic.
- **Deterministic where it counts.** The search is pure given its config, an
  injected evaluator, and an injected random source — no reading the clock, no
  bare `Math.random`, same discipline as `autoFill` and `selectEnginePly`.
- **Tree retention is the driver's job, not the search's.** The per-move search
  is a pure function of a (possibly pre-populated) root; carrying the root
  between turns, descending it, and discarding siblings belong to the stateful
  driver so the search itself stays pure and easy to test.
- **Async from day one, still.** The move remains a `Promise` and the UI keeps
  modeling "waiting for the computer" as a real state, so moving the search to
  a Web Worker (if the plan chooses that) does not reshape the turn flow.
- **Player-facing text** is unchanged in tone: "the computer", side colors,
  the rules' piece names, and "move" (never "ply"). Difficulty labels read
  plainly to a non-technical player.

## Out of scope

Deliberately excluded — later stories (or never):

- **The model manifest / metadata and the three compatibility states**
  (exact / compatible-degraded / incompatible), prior flattening for stale
  models, and the uniform/blended prior those need. This story keeps the
  hardcoded single model and only wires the policy-head prior.
- **Temperature / visit-count sampling**, checkpoint-based difficulty, multiple
  models, or any model-selection UI beyond the three iteration-budget modes.
  The three modes differ **only** in iteration count here.
- **Transposition tables / DAG search.** The tree is a plain game tree keyed by
  ply; positions reachable by different move orders get separate nodes. A
  transposition table is a possible later optimization, not this story.
- **Encoding parity fixtures** from the companion project and any real
  strength or correctness-vs-Python validation. Correctness here is legality,
  terminal handling, and tree/budget bookkeeping under a fake evaluator.
- **A placement policy for the computer.** Its army stays a random `autoFill`
  arrangement; the search is play-phase only.
- **WebGPU, quantization, or multi-threaded WASM.** Whatever responsiveness
  work the baseline needs (single-threaded WASM, per story 00000019's
  static-host constraint) is in scope; these upgrades are not.
- **The go-forward real-model storage policy** and swapping in trained weights.
  Still the follow-up's call; this story runs the same tiny zero-weight model.

## Manual-verification gates

- **Gate A — Difficulty at setup.** The setup screen offers easy / medium /
  hard alongside the side choice; picking one and a side takes you into
  placement, and the game then plays with that difficulty. Backing out returns
  to the start screen; starting again lets you pick a different difficulty.
- **Gate B — A full game, all three modes.** You can play a complete game end
  to end at each difficulty. On the computer's turn the "thinking" state shows,
  the board is inert, and the computer makes **exactly one legal move** (plain,
  two-square unencumbered, or an attack with the correct removals). Over a full
  game — including near the flag and against Towers — the computer **never**
  makes an illegal or off-board move at any difficulty.
- **Gate C — Search reuse and responsiveness.** Hard mode (7500 / cap 15000)
  stays responsive: the UI does not freeze while the computer thinks, and the
  "thinking" indicator behaves through a genuine wait. Playing a line the
  computer "expected" (and one it did not) both continue cleanly — no stalls,
  no stuck board, no doubled moves.
- **Gate D — Endings.** Flag capture in either direction, a no-legal-move loss,
  and the 50-move inactivity draw all still end the game with the right winner
  named by color, at every difficulty. No draw-offer control.
- **Gate E — Leaving and new game.** Leaving mid-game warns and, on confirm,
  returns to start; starting a new game begins cleanly with a fresh side,
  difficulty, placement, random computer army, and **no retained tree** from
  the previous game.
- **Gate F — Accessibility.** With the mouse away, a full game at each
  difficulty is keyboard-playable; with a screen reader on, the difficulty
  choice, the "thinking" state, each computer move, and the result are
  announced, and focus stays visible and untrapped — extending story
  00000019's patterns, not replacing them.

## Open items to resolve at plan time

Presentation and structure only — the policy above is fixed:

- **Where the search runs:** main thread with cooperative yielding vs a Web
  Worker, given up to 15000 evaluations per move on hard. Confirm what keeps
  the UI responsive with single-threaded WASM; the async move boundary stays a
  `Promise` either way.
- **How the retained tree is held** in `EngineGame.tsx` (a ref alongside the
  existing session state) and how descent interacts with the existing
  `cancelled`/StrictMode effect guards and the apply-first-then-slide ordering
  — so a superseded or cancelled turn never corrupts or leaks the tree.
- **How the stateful driver supersedes `chooseEnginePly`** — whether
  `enginePlayer.ts` grows a search-driver object/class or is replaced — while
  keeping the same injectable-evaluator/random seams for tests.
- **The exact counting for the double cap** — root visit count vs total node
  count — and precisely how retained visits are measured when deciding how many
  new simulations to run. (The intent, full budget each move and a 2× hard cap,
  is fixed; only the accounting is open.)
- **PUCT constants** — the exploration constant (and any prior/Dirichlet-noise
  choices) as fixed values in the config object for this single-model story.
- **The difficulty control's placement and wording** (labels, whether the
  iteration numbers are shown) and where it sits relative to the side choice on
  the setup screen.
- **The step decomposition** that keeps the app green at every commit — likely
  the pure search engine (with tests) → the stateful retaining driver and
  budget/cap (with tests) → the difficulty setup UI → wiring into the play loop
  and responsiveness → accessibility polish.
