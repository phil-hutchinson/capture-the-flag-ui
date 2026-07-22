# Story 00000019 — Play against the engine (baseline)

## Summary

Add a third thing you can do with this app: **play a game against the
computer**. Today the start screen offers hot-seat play and reviewing a
recorded game; this story adds "play against the computer" alongside them.

You choose a side (red or blue), place your army with the placement flow you
already know, and then play — except the other army is played by the trained
network from the companion project, running **in the browser**. On the
computer's turn the board goes quiet for a moment while it decides, then it
makes its move, and the game continues to its normal ending.

This is **baseline wiring, on purpose.** The whole path is real — the board
is encoded into the network's input, the network runs, its output is turned
back into an actual move, and that move is played through the same rules the
hot-seat game uses. But the model we ship this story is the **reference model
with zero weights**, so the computer plays **effectively at random**. That is
expected and accepted: the goal here is a genuinely playable, end-to-end path
from board to network to move, not a strong opponent. A **follow-up story**
hardens it — real trained models, a model manifest binding a model to a
ruleset, difficulty, and search — on top of the plumbing this story lays down.

## Background & references

- **The engine's tensor contract** is specified in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository at `doc/neuralnetwork/eng-nn-1.md` (spec **ENG_NN_1**). In
  outline: input is an `(18, 12, 12)` float tensor **from the perspective of
  the player to move** (the board rotates 180° when Black moves, so the
  mover's back rank is always row 0); planes 0–7 are the mover's pieces and
  8–15 the opponent's, in the order Flag, Tower, Master-of-Arms, Champion,
  Knight, Halberdier, Foot Soldier, Militia; plane 16 marks passable squares;
  plane 17 carries the inactivity count as a fraction of the draw threshold.
  The **value head** is a scalar in `[−1, 1]` from the mover's perspective.
  The **policy head** is `(8, 12, 12)` logits indexed by (movement index,
  row, column) in the mover's frame, where the 8 movement indices are the
  one- and two-square orthogonal offsets (up/right/down/left one, then
  up/right/down/left two). The spec names ruleset **1.2:PRE-RELEASE** as its
  compatible ruleset. **Note:** the spec file has **no metadata block yet**;
  it is not needed this story (the model, encoding and ruleset are hardcoded
  here and negotiated properly in the follow-up).
- **Design context.** `.local/browser-ai-notes.md` (a pre-story design
  conversation, not committed work) lays out the intended shape of in-browser
  AI: ONNX inference via **onnxruntime-web**, the search loop reimplemented in
  TypeScript over the existing rules engine, a model manifest, difficulty
  dials, and a natural split into three stories (model loading + parity,
  search, play-vs-AI UI). **This story is a deliberately thin vertical slice
  across all three at minimal fidelity** — enough to play — and explicitly
  defers the manifest, tree search, difficulty, and parity fixtures to the
  follow-up.
- **The rules engine already does the hard part.** `src/rules/primary/v1/`
  generates legal plies (`legalDestinations`, `legalAttacks`,
  `hasAnyLegalPly` in `movement.ts`), applies them (`applyMove` in `play.ts`),
  detects endings (`computeOutcome` in `outcome.ts`), and produces a random
  legal army (`autoFill` in `placement.ts`). The computer opponent **drives**
  this engine — it never reimplements a rule. The legal-ply set is always
  authoritative; the network only ranks the plies the engine already allows.
- **The reference model** lives at `.local/ctf_reference.onnx` (~95 KB, zero
  weights). This story **commits it into the repo** as a served static asset
  and loads it with onnxruntime-web (WASM), consistent with static-file
  hosting — no backend. Committing it is deliberate: it keeps the story
  self-contained rather than dependent on a hidden, gitignored `.local/` file,
  and the file is tiny. It is a throwaway placeholder — expected to be
  **deleted or replaced** once real trained models arrive. Whether and how
  *real* models are stored (committed directly, Git LFS, or fetched at
  deploy) is **not decided here** — the models may grow, the design is still
  settling, and that call belongs to the follow-up. See Out of scope.
- **The app shell** (`App.tsx`) already switches between four screens
  (start / play / import / review) with a discriminated union in `useState`,
  no router. This story adds a fifth. The board, placement and play
  components, and the play session (`src/board/playSession.ts`,
  `applyMove`), are reused, not forked.

## Policy (fixed by the owner, 2026-07-21)

- **Baseline wiring, not strength.** The deliverable is a real, playable
  end-to-end path — encode the board, run the network, decode a legal move,
  play it — working from start screen to game result. With the zero-weight
  reference model the computer plays **effectively at random**; that is the
  expected outcome this story and is acceptable. Nothing here should have to
  be redone to make the opponent strong — that is swapping the model and
  adding search, which is the follow-up.
- **The computer's army is placed at random.** It reuses the existing random
  auto-arrange (`autoFill`) to get a valid legal army (respecting the
  no-adjacent-Towers rule), placed silently and unseen. The human places
  their own army with the existing placement flow, unchanged.
- **You choose your side each game.** At setup you pick **play as red** or
  **play as blue**. Red moves first; so if you choose blue, the computer
  (red) makes the first move.
- **Raw-policy move selection — no search this story.** The computer makes
  **one network evaluation per move** and picks its move directly from the
  policy over the legal plies. It **samples** from the network's policy
  distribution restricted to the legal plies (rather than always taking the
  single highest-scoring one), so that with the flat zero-weight model it
  genuinely varies its play rather than repeating one degenerate line. PUCT
  tree search and its config live in the follow-up.
- **One model, one ruleset, hardcoded.** The mode targets ruleset
  `1.2:PRE-RELEASE` and the single bundled reference model. No manifest, no
  compatibility checks (exact / degraded / incompatible), no ruleset-or-flag
  negotiation, and no difficulty presets — all follow-up.
- **Board orientation is always yours.** The board is drawn from the human
  player's perspective and does not flip; the "flip between turns" setting
  (story 00000012) belongs to hot-seat and is not shown here.
- **No draw offers against the computer.** The computer neither offers nor
  accepts a draw, so this mode has no draw-offer control. The automatic
  endings — flag capture, no-legal-move loss, and the 50-move inactivity
  draw — all still apply exactly as in hot-seat.
- **No parity fixtures this story.** The companion project can't ship
  input/output parity fixtures into this repo yet, so correctness rests on
  the invariant that **the computer only ever plays a move the rules engine
  calls legal**, held by unit tests and a manual play-through. Verifying the
  encoder against real engine-produced fixtures is a follow-up.

## Players and colors

Unchanged: first player = White = Side A = red (`#a13d2b`); second player =
Black = Side B = blue (`#33526b`). Player-facing surfaces name the sides by
color (red / blue), use the rules' piece names exactly (e.g. "Master-of-Arms",
"Foot Soldier"), and use the word "move" (never "ply"). The opponent is
referred to in player-facing text as **the computer**; "engine" is the
internal term (code, tests, docs). The player is named by their color in the
result ("Red wins", "the computer (blue) wins"), like the other modes.

## In scope

1. **A third start-screen choice.** The start screen now offers a third
   option — **play against the computer** — beside "play a game" and "review a
   game", labeled so a player understands it without explanation.
2. **Game setup: choose a side.** Choosing the new mode first asks whether you
   want to play as red or blue, then takes you into placement. Backing out
   returns to the start screen.
3. **Placement.** You place your 25-piece army with the existing placement
   flow (the same tray, board, tower-adjacency rule and messaging). The
   computer's army is generated by `autoFill` — a valid random arrangement —
   and is not shown to you before play begins.
4. **Encoding the board (the input tensor).** A new **encoder** turns a game
   state into the ENG_NN_1 `(18, 12, 12)` input tensor: the mover's and
   opponent's piece planes in the spec's order, the passable plane, the
   inactivity plane, and the mover's-perspective 180° rotation and coordinate
   mapping. It lives in its **own versioned folder** (encoding v1), mirroring
   `src/rules/primary/`, because the tensor contract versions on its own axis
   separate from the ruleset.
5. **Running the network.** onnxruntime-web and the reference `.onnx` are
   bundled as served static assets; the model is loaded once and run on a
   position to produce the value scalar and the policy tensor.
6. **Choosing the move (decode + legal mask + sample).** The policy head is
   decoded into `(from, to)` plies using the movement-index offsets in the
   mover's frame, **masked to the legal plies** the rules engine reports for
   that position, and the computer's move is **sampled** from that masked
   distribution. Exactly one evaluation per move; no tree search. An illegal
   or off-board policy index can never be selected.
7. **Turn flow.** On your turn the board plays exactly as in hot-seat. On the
   computer's turn the board is inert, a brief "the computer is thinking"
   indicator shows, and then the computer's chosen move is applied through the
   **same `applyMove` path** the human uses — same announcements, same record,
   same game-end detection.
8. **Endings.** Flag capture, no-legal-move loss, and the 50-move inactivity
   draw all end the game as in hot-seat, and the result screen names the
   winner by color (you or the computer). There is no draw-offer control.
9. **Leaving.** A way back to the start screen, with the same in-progress
   confirmation hot-seat uses (leaving mid-placement or mid-play warns that
   the game will be lost). Returning and choosing the mode again starts
   cleanly: fresh side choice, fresh placement, fresh random computer army.
10. **Accessibility.** The side choice, the "computer is thinking" state
    (announced, not just shown), and each computer move (announced like a
    human move) are all keyboard-operable and conveyed to assistive
    technology, extending the established grid and live-region patterns.
11. **The app works at every step.** Each step is verified (typecheck, lint,
    tests, plus its own verification) and committed before the next, per the
    standard pipeline; a game against the computer is playable by the end.

## Design decisions & constraints

- **Reuse, don't fork.** The mode reuses the board, piece art, placement flow
  and play session. The only genuinely new thing in the play loop is **who
  supplies the next move** — the human (as now) or the computer. It must not
  fork the board component, the piece rendering, or the play state; if a
  shared play shell parameterized by "who moves next" is the clean way to
  avoid duplicating hot-seat, prefer that over a copy.
- **The engine drives the rules; it never owns them.** Legal plies, state
  transitions and terminal detection come only from `src/rules/primary/v1/`.
  The network ranks legal plies; the legal mask is always authoritative. This
  is what keeps a zero-weight (or, later, a stale) model from ever producing
  an illegal move.
- **Encoding is its own version axis.** The encoder goes in a folder-per-
  version layout mirroring the rules, even though there is one encoder today,
  so a future encoding change is additive rather than a rewrite. This story
  implements **encoding v1** and binds it to ruleset `1.2` implicitly (the
  manifest that makes the binding explicit is the follow-up).
- **Async from day one.** A computer move is a `Promise`; the UI models
  "waiting for the computer" as a real state. This keeps the door open to
  moving inference into a Web Worker and to adding real search later without
  reshaping the turn flow.
- **Deterministic where it counts.** The encoder and the decode/mask are pure
  and unit-tested against ENG_NN_1 with hand-built positions. Move sampling
  takes an **injectable random source** (the same pattern `autoFill` uses),
  so tests are reproducible while the UI uses real randomness.
- **Static-host friendly.** The `.onnx` file and onnxruntime-web's WASM
  binaries ship as static assets served alongside the app — no backend, no
  special server headers assumed (single-threaded WASM; see open items).
- **Player-facing text** uses "the computer", the sides' colors, the rules'
  piece names, and the word "move" (never "ply"). Rule concepts a player
  meets are described in plain words, not jargon.

## Out of scope

Everything below is the **follow-up story's** job (or later), and is
deliberately excluded here:

- **Model manifest / metadata** — binding a model to a ruleset version, flag
  configuration and encoding version; the three compatibility states (exact /
  compatible-degraded / incompatible) and prior flattening for stale models.
- **PUCT tree search** and its config object (simulation count, exploration
  constant, temperature, prior source/blend). This story is raw-policy,
  one-evaluation-per-move only.
- **Difficulty** — presets, multiple checkpoints, or any model selection UI.
- **Encoding parity fixtures** from the companion project, and any real
  strength or correctness-vs-Python verification.
- **A placement policy for the computer** (secret-phase AI). The computer's
  army stays a random `autoFill` arrangement.
- **Web Worker / WebGPU** performance work beyond whatever the baseline needs
  to stay responsive, and **quantization** choices (fp16/int8).
- **Saving or reviewing** a game played against the computer. The record
  writer is unchanged; reviewing an engine game remains the existing
  reviewer's job on a saved file, still gated on the save-to-file story.
- **Choosing among several models**, loading a model by URL, or any
  networking/backend.
- **The go-forward model-storage policy.** How *real* trained models (which
  may be larger than this placeholder) are stored and served — committed
  directly, Git LFS, or fetched at deploy — is left open on purpose. This
  story only commits the tiny zero-weight reference so it stands alone; the
  follow-up's model manifest should reference models **by path**, so the
  storage mechanism can change later without touching the inference code.

## Manual-verification gates

- **Gate A — Setup and placement.** The start screen shows the third choice.
  Choosing it lets you pick a side and place your army; play then begins with
  both armies on the board — yours as you placed it, the computer's a valid
  random arrangement with no two Towers adjacent. Choosing **blue**, the
  computer (red) makes the first move; choosing **red**, you do.
- **Gate B — A full game.** You can play a complete game against the computer,
  end to end. On your turn the board behaves as in hot-seat. On the computer's
  turn a "thinking" indicator shows, the board is inert, and then the computer
  makes **exactly one legal move** — a plain move, a two-square unencumbered
  move, or an attack with the correct removals — and play continues. Over a
  full game (including moves near the flag and against Towers) the computer
  **never** makes an illegal or off-board move.
- **Gate C — Endings.** A flag capture in either direction ends the game with
  the right winner named by color; a no-legal-move loss and the 50-move
  inactivity draw both still fire and read correctly on the result screen.
  There is no draw-offer control in this mode.
- **Gate D — Leaving.** Going back to the start screen mid-game warns that the
  game will be lost and, on confirm, returns to start; cancelling leaves the
  game untouched and playable. Starting a new game against the computer begins
  cleanly (fresh side choice, fresh placement, fresh random computer army).
- **Gate E — Accessibility.** With the mouse put away, a full game against the
  computer is playable by keyboard alone; with a screen reader on, the side
  choice, the "computer is thinking" state, each computer move, and the result
  are announced, and focus stays visible and untrapped.

## Open items to resolve at plan time

Presentation and structure only — the policy above is fixed:

- **Where inference runs:** main thread vs a Web Worker for the baseline.
  Expectation: the main thread is adequate for the zero-weight model, but the
  computer-move boundary stays async (a `Promise`) so a worker can be dropped
  in later without reshaping the flow. Confirm onnxruntime-web's WASM load
  doesn't jank the UI enough to force a worker now.
- **Where the served assets live** and how the committed
  `ctf_reference.onnx` and onnxruntime-web's WASM binaries are bundled for
  static hosting (a `public/` copy step vs the bundler's asset handling), and
  confirming **onnxruntime-web** as the inference dependency under the
  project's "major, well-maintained libraries only" policy. (That the
  reference model *is* committed is settled; only the how-served mechanics are
  open — the storage policy for future real models is out of scope, above.)
- **Confirm the ENG_NN_1 tensor details** against the spec as it stands at
  plan time — plane order, the two coordinate mappings, the movement-index
  offsets, and the value/policy tensor names and shapes — since the file has
  no metadata block yet.
- **How the new mode is modeled** in `App.tsx`'s screen union, and whether an
  engine-game component parallels `HotSeatGame` or the two share a common play
  shell parameterized by who moves next (preferred if it cleanly avoids
  duplicating the hot-seat play loop).
- **The exact player-facing wording** for the mode's label and the "thinking"
  indicator, and where the side-choice control sits.
- **Whether the "thinking" indicator has a minimum visible duration** so an
  instant move (inevitable with the tiny model) doesn't flash — presentation
  only.
- **The step decomposition** that keeps the app green at every commit — likely
  encoder (with tests) → model loading + inference → decode/mask/sample (with
  tests) → the game mode, screen, and setup UI → accessibility polish.
