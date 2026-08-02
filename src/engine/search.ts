// Pure PUCT (Predictor + Upper Confidence bounds applied to Trees)
// Monte-Carlo tree search core (story 00000021, Step 1). Drives the existing
// rules engine forward from a root `PlayState`: every edge in the tree is a
// legal ply enumerated by the rules engine (`enumerateLegalPlies`, shared
// unchanged with the raw-policy decoder so both mask against exactly the same
// legal set), every child node's `PlayState` comes from `applyMove`, and
// every terminal is `computeOutcome` (already folded into `PlayState.result`
// by `applyMove`/`startPlay`). The network only ranks (the policy head, as
// each expanded node's children's priors) and evaluates (the value head, as
// a newly-expanded leaf's backed-up value) - it never invents a move or a
// game result. See story.md's "Real tree search replaces raw policy".
//
// This module is pure and dependency-free beyond the rules engine and the
// decoder's shared legal-ply/policy-index helpers: no worker, no DOM, no
// onnxruntime import at runtime - `EngineEvaluation` is imported with
// `import type` only, so `inference.ts` (which imports onnxruntime-web at
// module scope) is never pulled into this module's runtime dependency graph.
// The evaluator and the random source are both injected (`PositionEvaluator`,
// `RandomSource`), so the search is fully deterministic given a fixed
// evaluator and random source - no clock, no bare `Math.random`, no
// module-level mutable state, matching `autoFill`'s discipline.
//
// This is the pure heart the stateful driver (Step 2, tree retention across
// turns) and, through it, the worker (Step 3) build on.
//
// NON-FUNCTIONAL under the major-2 rules (story 00000023, Step 9): this
// module expands a node's legal plies through `enumerateLegalPlies`/
// `policyIndexForPly` (`../encoding/eng-nn-1/decoder.ts`), whose movement-
// index table only covers the eight orthogonal offsets - it throws if a
// diagonal attack (major 2's new rule) is among the position's legal plies.
// "Play against the computer" is disabled on the start screen and nothing in
// the live app calls this module; its unit tests were removed rather than
// kept green against a shrunken, no-longer-representative set of positions.
// Re-enabling computer play needs a new engine spec (out of scope here; see
// story.md's "Computer play disabled").

import {
  enumerateLegalPlies,
  policyIndexForPly,
  type Ply,
  type RandomSource,
} from "../encoding/eng-nn-1/decoder.ts";
import type { Position } from "../encoding/eng-nn-1/encoder.ts";
import { applyMove, type PlayState } from "../rules/primary/v2/play.ts";
import type { EngineEvaluation } from "./inference.ts";

/**
 * Evaluates a position and returns the network's raw value/policy output.
 * Relocated here (story 00000021, Step 1, fixed decision 10) from
 * `enginePlayer.ts` - the search, driver, and worker are the seams that need
 * it, not just the raw-policy baseline `enginePlayer.ts` used to provide
 * (removed in Step 5 once `EngineGame.tsx` stopped calling it). Injectable so
 * the search is unit-testable without loading WASM: tests pass a fake
 * evaluator returning a hand-built value/policy pair. Defaults to the real
 * `evaluatePosition` (`src/engine/inference.ts`) in production (the worker,
 * Step 3). May resolve synchronously or asynchronously - the search always
 * awaits it.
 */
export type PositionEvaluator = (
  position: Position,
) => EngineEvaluation | Promise<EngineEvaluation>;

/**
 * Tuning constants for the PUCT search (story 00000021, fixed decision 5):
 * `cPuct` is the exploration constant in the PUCT score - `actionValue +
 * cPuct * prior * sqrt(parentVisits) / (1 + childVisits)` (see `selectEdge`).
 * Kept as a config object (rather than a hardcoded constant) so a later story
 * can tune it, or add Dirichlet root noise, without reshaping the search;
 * this story fixes `cPuct = 1.5` and adds no root noise.
 */
export interface SearchConfig {
  readonly cPuct: number;
}

/** This story's fixed PUCT constants (fixed decision 5): `cPuct = 1.5`, no Dirichlet root noise. */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = { cPuct: 1.5 };

/**
 * One legal ply out of a node, plus the search's bookkeeping for it: the
 * network's prior probability for choosing it, and - lazily, the first time
 * this edge is traversed - the child node it leads to (built via
 * `applyMove`). Left `undefined` until then so a wide node does not eagerly
 * apply every one of its legal plies before the search ever visits them.
 */
export interface SearchEdge {
  readonly ply: Ply;
  readonly prior: number;
  child: SearchNode | undefined;
}

/**
 * One position in the search tree: its `PlayState`, and - once expanded, via
 * `expand` below - one `SearchEdge` per legal ply from it. `visitCount` and
 * `totalValue` are this node's own bookkeeping, always accumulated from *its
 * own* side-to-move's perspective (see `backpropagate`'s sign-flipping) -
 * never the perspective of whichever node is looking at it as a child. A
 * child has exactly one parent in this tree (no transposition table - see
 * story.md's "Out of scope"), so a child's own `visitCount`/`totalValue`
 * double as the single edge leading to it's `N(s,a)`/`W(s,a)` in the usual
 * PUCT notation; see `selectEdge`'s `actionValue` for how that is read back
 * from the *parent*'s perspective.
 */
export interface SearchNode {
  readonly state: PlayState;
  edges: SearchEdge[] | undefined;
  visitCount: number;
  totalValue: number;
}

/**
 * A fresh, unexpanded node for `state`, with no visits yet - the tree's unit
 * of construction. Used here for a brand-new root; the stateful driver
 * (Step 2) reuses it when a retained root's descended child needs building.
 */
export function createSearchNode(state: PlayState): SearchNode {
  return { state, edges: undefined, visitCount: 0, totalValue: 0 };
}

/**
 * True once `node` has been expanded (its `edges` built by `expand`) - false
 * for a brand-new leaf, and always false for a terminal node (which
 * `runIteration` never expands - see `isTerminal`).
 */
export function isExpanded(node: SearchNode): boolean {
  return node.edges !== undefined;
}

/**
 * True iff `node`'s position is a finished game
 * (`PlayState.result.kind !== "ongoing"`). A terminal node is never expanded
 * and never evaluated by the network (see `terminalValue`) - its true game
 * result backs up instead.
 */
export function isTerminal(node: SearchNode): boolean {
  return node.state.result.kind !== "ongoing";
}

/**
 * The true game result at a terminal node's own position, from *its own*
 * side-to-move's perspective, per story.md's "Terminal nodes": a loss for the
 * side to move (`noLegalMove`, or a `flagCapture` win for the opponent) is
 * `-1`, a win for the side to move is `+1`, and a draw (`inactivity`) is `0`.
 * Throws if `state.result` is still `"ongoing"` - a programming-invariant
 * guard; callers only ever call this once `isTerminal` has reported true.
 */
function terminalValue(state: PlayState): number {
  const result = state.result;
  if (result.kind === "draw") {
    return 0;
  }
  if (result.kind === "win") {
    return result.winner === state.sideToMove ? 1 : -1;
  }
  throw new Error(
    "terminalValue: called on a state that is still ongoing - the caller must check `isTerminal` first.",
  );
}

/** The softmax distribution over `logits`, numerically stabilized by subtracting the max. */
function softmax(logits: readonly number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - max));
  const sum = exps.reduce((total, exp) => total + exp, 0);
  return exps.map((exp) => exp / sum);
}

/**
 * Expands `node` (must be unexpanded and non-terminal - a programming
 * invariant `runIteration` upholds): enumerates its legal plies from the
 * rules engine (`enumerateLegalPlies`, the same helper the raw-policy decoder
 * uses, so both mask against exactly the same legal set), reads each legal
 * ply's logit out of `policy` via `policyIndexForPly` in `node`'s own
 * side-to-move's frame, and takes the softmax over *only* those legal logits
 * as each edge's prior - an illegal or off-board policy index is never
 * considered, let alone assigned a prior. Mutates `node.edges` in place.
 * Every ongoing position has at least one legal ply (`computeOutcome`'s
 * `noLegalMove` check would already have made it terminal otherwise), so
 * `plies` is never empty here.
 */
function expand(node: SearchNode, policy: Float32Array): void {
  const plies = enumerateLegalPlies(node.state.board, node.state.sideToMove);
  const logits = plies.map(
    (ply) => policy[policyIndexForPly(ply, node.state.sideToMove)],
  );
  const priors = softmax(logits);
  node.edges = plies.map((ply, index) => ({
    ply,
    prior: priors[index],
    child: undefined,
  }));
}

/**
 * The value of choosing `edge` from its *parent*'s perspective (the standard
 * PUCT `Q(s,a)`), or `0` if `edge`'s child has never been visited (the usual
 * PUCT convention for an unvisited action - it competes purely on prior and
 * exploration until it has evidence of its own). This is the *negation* of
 * the child's own accumulated mean value: the child's `totalValue` is banked
 * from the child's own side-to-move's perspective (`backpropagate`), and the
 * child's mover is always the parent's opponent - exactly one ply apart, so
 * exactly one sign flip separates the two perspectives.
 */
function actionValue(edge: SearchEdge): number {
  const child = edge.child;
  if (child === undefined || child.visitCount === 0) {
    return 0;
  }
  return -(child.totalValue / child.visitCount);
}

/**
 * Chooses one of `node`'s (already expanded) edges by the PUCT rule:
 * `actionValue(edge) + cPuct * prior * sqrt(parentVisits) / (1 +
 * childVisits)`, where `parentVisits` is `node.visitCount` *before* this
 * iteration (the standard convention - `node`'s own visit count already
 * reflects every earlier iteration that passed through it, and only
 * increments, via `backpropagate`, once this iteration's path completes) and
 * `childVisits` is the edge's child's visit count, or `0` if the child has
 * never been created. Ties (exact score equality - common early on, e.g.
 * every child unvisited under a uniform prior) are broken by `random`, so
 * selection is fully deterministic given a fixed `RandomSource`.
 */
function selectEdge(
  node: SearchNode,
  config: SearchConfig,
  random: RandomSource,
): SearchEdge {
  const edges = node.edges;
  if (edges === undefined) {
    throw new Error("selectEdge: node must already be expanded.");
  }

  const sqrtParentVisits = Math.sqrt(node.visitCount);
  let bestScore = -Infinity;
  let bestEdges: SearchEdge[] = [];

  for (const edge of edges) {
    const childVisits = edge.child?.visitCount ?? 0;
    const score =
      actionValue(edge) +
      config.cPuct * edge.prior * (sqrtParentVisits / (1 + childVisits));
    if (score > bestScore) {
      bestScore = score;
      bestEdges = [edge];
    } else if (score === bestScore) {
      bestEdges.push(edge);
    }
  }

  if (bestEdges.length === 1) {
    return bestEdges[0];
  }
  const index = Math.min(
    bestEdges.length - 1,
    Math.floor(random() * bestEdges.length),
  );
  return bestEdges[index];
}

/**
 * Backs `leafValue` (from the leaf's own side-to-move's perspective) up
 * `path` (root-to-leaf order), flipping its sign at every step: every ply
 * alternates the side to move, so each node up the path accumulates value
 * from *its own* side-to-move's perspective, per story.md's "Perspective
 * sign-flipping on back-propagation." Every node on the path - including the
 * leaf itself and the root - has its `visitCount` and `totalValue` updated.
 */
function backpropagate(path: readonly SearchNode[], leafValue: number): void {
  let value = leafValue;
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const node = path[i];
    node.visitCount += 1;
    node.totalValue += value;
    value = -value;
  }
}

/**
 * Runs a single PUCT simulation from `root`: selects a path down by
 * `selectEdge` until reaching an unexpanded or terminal node (creating each
 * child lazily, via `applyMove`, the first time its edge is traversed),
 * expands and evaluates a newly-reached non-terminal leaf (`expand`, plus the
 * injected `evaluate`) - or, for a terminal leaf, reads off its true result
 * (`terminalValue`) without expanding or evaluating it - then backs the value
 * up the path (`backpropagate`). If `root` itself is already terminal (no
 * selection ever runs), this just re-derives and re-backs-up the same fixed
 * terminal value into `root` - harmless, and exactly what a hand-built
 * already-finished root needs (see the search's tests).
 */
async function runIteration(
  root: SearchNode,
  evaluate: PositionEvaluator,
  config: SearchConfig,
  random: RandomSource,
): Promise<void> {
  const path: SearchNode[] = [root];
  let node = root;

  while (isExpanded(node) && !isTerminal(node)) {
    const edge = selectEdge(node, config, random);
    if (edge.child === undefined) {
      const { state } = applyMove(node.state, edge.ply.from, edge.ply.to);
      edge.child = createSearchNode(state);
    }
    node = edge.child;
    path.push(node);
  }

  let leafValue: number;
  if (isTerminal(node)) {
    leafValue = terminalValue(node.state);
  } else {
    const position: Position = {
      board: node.state.board,
      sideToMove: node.state.sideToMove,
      inactivityCounter: node.state.inactivityCounter,
    };
    const { value, policy } = await evaluate(position);
    expand(node, policy);
    leafValue = value;
  }

  backpropagate(path, leafValue);
}

/**
 * Runs `iterations` PUCT simulations from `root` (mutating and returning it),
 * awaiting `evaluate` once per newly-expanded leaf. No cooperative
 * main-thread yielding is added here - the search runs off the main thread in
 * a Web Worker (Step 3), and awaiting the async evaluator each iteration
 * already turns that worker's event loop; see story.md's "Async from day
 * one."
 */
export async function runSearch(
  root: SearchNode,
  iterations: number,
  evaluate: PositionEvaluator,
  config: SearchConfig = DEFAULT_SEARCH_CONFIG,
  random: RandomSource = Math.random,
): Promise<SearchNode> {
  for (let i = 0; i < iterations; i += 1) {
    await runIteration(root, evaluate, config, random);
  }
  return root;
}

/**
 * Reads off `root`'s most-visited child as the chosen ply - the search's
 * answer, not a raw policy sample (story.md's "The chosen move is the
 * search's most-visited root child"). Ties (equal visit counts - most likely
 * before enough iterations have run to separate two children, e.g. every
 * child still at 0 visits right after root's first expansion) are broken by
 * `random`. Throws if `root` has not been expanded (no simulation has run
 * through it yet) - the caller must run at least one search iteration before
 * asking for the chosen ply.
 */
export function mostVisitedPly(
  root: SearchNode,
  random: RandomSource = Math.random,
): Ply {
  const edges = root.edges;
  if (edges === undefined || edges.length === 0) {
    throw new Error(
      "mostVisitedPly: root has not been expanded - run at least one search iteration first.",
    );
  }

  let bestVisits = -1;
  let bestEdges: SearchEdge[] = [];
  for (const edge of edges) {
    const visits = edge.child?.visitCount ?? 0;
    if (visits > bestVisits) {
      bestVisits = visits;
      bestEdges = [edge];
    } else if (visits === bestVisits) {
      bestEdges.push(edge);
    }
  }

  const index =
    bestEdges.length === 1
      ? 0
      : Math.min(bestEdges.length - 1, Math.floor(random() * bestEdges.length));
  return bestEdges[index].ply;
}
