// Pure stateful search driver (story 00000021, Step 2). Owns the retained
// PUCT tree across turns and applies the iteration budget/double-cap
// arithmetic on top of Step 1's pure search (`search.ts`). No worker, no DOM
// - the worker (Step 3) hosts an instance of this class; this module is a
// plain, directly-Vitest-testable object, per story.md's "Tree retention is
// the driver's job, not the search's."
//
// Three seams cross this class's boundary, matching the search's own
// discipline (no clock, no bare `Math.random`, no hidden mutable state beyond
// the two tree references this class exists to own):
//   - an injected `PositionEvaluator` (the search's leaf evaluation);
//   - an injected `RandomSource` (tie-breaking, forwarded to the search);
//   - a `SearchDriverConfig` fixing the mode's iteration budget `B` and the
//     derived double cap `2*B` (fixed decision 4) - both supplied by the
//     caller (Step 4's difficulty presets), not computed here, so a future
//     story can change the cap's relationship to the budget without touching
//     this arithmetic.
//
// Four operations, matching story.md's "The tree is retained across both
// players' moves" and fixed decision 8 ("commit only on confirm"):
//   - `choose(state)` - the computer's turn. Reconciles the retained root
//     against `state` (reuse if it matches, otherwise start fresh), searches
//     a *cloned working tree* (never mutating the stored retained root) for
//     `min(B, max(0, 2*B - R))` new iterations, and returns the most-visited
//     root child. The working tree is held as *pending*, not yet adopted.
//   - `commit(ply)` - adopts the pending working tree as the new retained
//     root, descended into `ply`'s child (discarding its siblings). Only this
//     call advances the retained tree forward from the computer's own move;
//     a `choose` whose result is never committed leaves the retained tree
//     untouched, and the next `choose` simply builds and searches a new
//     working tree (dropping the stale pending one).
//   - `observe(ply)` - the human's reply. Descends the retained root into the
//     matching child (discarding its siblings) or, if `ply` was never
//     explored, discards the tree entirely so the next `choose` starts fresh.
//   - `reset()` - drops both the retained tree and any pending working tree
//     (a fresh game never inherits one).
//
// NON-FUNCTIONAL under the major-2 rules (story 00000023, Step 9): this
// class drives `search.ts`, which throws on a diagonal attack (see that
// module's own header note). "Play against the computer" is disabled and
// nothing in the live app calls this module; its unit tests were removed
// rather than kept green against a shrunken, no-longer-representative set of
// positions. Re-enabling computer play needs a new engine spec (out of
// scope here; see story.md's "Computer play disabled").

import { squareKey } from "../rules/primary/v2/board.ts";
import type { PlayState } from "../rules/primary/v2/play.ts";
import type { Ply, RandomSource } from "../encoding/eng-nn-1/decoder.ts";
import {
  createSearchNode,
  mostVisitedPly,
  runSearch,
  type PositionEvaluator,
  type SearchConfig,
  type SearchEdge,
  type SearchNode,
} from "./search.ts";

/**
 * The driver's tuning knobs: Step 1's PUCT constants (`search`, forwarded
 * unchanged to `runSearch`) plus this mode's iteration budget `B` (`budget`)
 * and the derived double cap `2*B` (`cap`) - story.md's "Run the full
 * iteration budget every move, but cap the accumulated tree at double."
 * `cap` is taken as an explicit field (not recomputed as `2*budget` here) so
 * the difficulty presets (Step 4) are the single source of truth for both
 * numbers; this class only ever applies fixed decision 4's formula to
 * whatever `budget`/`cap` it is given.
 */
export interface SearchDriverConfig {
  readonly search: SearchConfig;
  readonly budget: number;
  readonly cap: number;
}

/** True iff `edge`'s ply is the same `from`/`to` pair as `ply` (compared by `squareKey`). */
function samePly(edge: SearchEdge, ply: Ply): boolean {
  return (
    squareKey(edge.ply.from) === squareKey(ply.from) &&
    squareKey(edge.ply.to) === squareKey(ply.to)
  );
}

/**
 * True iff `a` and `b` are the same position for the driver's reconciliation
 * purposes: same side to move, same inactivity count, and the same piece on
 * every square. The retained root's own `PlayState` and the `PlayState` a
 * caller hands to `choose` are generally *different* objects that happen to
 * describe the same position (the retained root's state was built by the
 * search's own `applyMove` calls along its descent path, not by whatever
 * `applyMove` call produced the caller's own state) - so this is a value
 * comparison, not a reference check.
 */
function statesMatch(a: PlayState, b: PlayState): boolean {
  if (
    a.sideToMove !== b.sideToMove ||
    a.inactivityCounter !== b.inactivityCounter
  ) {
    return false;
  }
  const keysA = Object.keys(a.board);
  const keysB = Object.keys(b.board);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    const pieceA = a.board[key];
    const pieceB = b.board[key];
    if (
      pieceB === undefined ||
      pieceA?.side !== pieceB.side ||
      pieceA?.pieceType !== pieceB.pieceType
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Deep-clones `node` and its entire explored subtree - a fresh set of
 * `SearchNode`/`SearchEdge` objects with the same `state` references (a
 * `PlayState` is never mutated in place, so sharing it is safe), the same
 * priors/visit counts/accumulated values, but no shared mutable structure
 * with `node` itself. This is the "private working tree" fixed decision 8
 * requires: `choose` searches this clone, never the stored retained root, so
 * a superseded/uncommitted `choose` cannot have mutated what is retained.
 */
function cloneTree(node: SearchNode): SearchNode {
  return {
    state: node.state,
    visitCount: node.visitCount,
    totalValue: node.totalValue,
    edges: node.edges?.map((edge) => ({
      ply: edge.ply,
      prior: edge.prior,
      child: edge.child === undefined ? undefined : cloneTree(edge.child),
    })),
  };
}

/**
 * The child of `node` reached by `ply`, or `undefined` if `ply` names none of
 * `node`'s edges, or names one whose child was never built (an edge the
 * search enumerated but never actually traversed - `SearchEdge.child` stays
 * `undefined` until an iteration first selects it, per `search.ts`). Both
 * cases mean "not explored" for the driver's purposes: a legal ply the
 * retained tree has an edge for but no simulated subtree under is exactly as
 * unusable as a ply with no edge at all - there's nothing to carry forward.
 */
function exploredChild(node: SearchNode, ply: Ply): SearchNode | undefined {
  return node.edges?.find((edge) => samePly(edge, ply))?.child;
}

/**
 * Owns the retained PUCT tree across a game against the computer and applies
 * the iteration budget/double-cap arithmetic on top of Step 1's pure search.
 * See this module's header comment for the four operations
 * (`choose`/`commit`/`observe`/`reset`) and fixed decision 8's commit-only-on-
 * confirm contract. Starts with no retained root - the first `choose` always
 * builds a fresh one.
 */
export class SearchDriver {
  private retainedRoot: SearchNode | undefined;
  private pendingRoot: SearchNode | undefined;

  constructor(
    private readonly config: SearchDriverConfig,
    private readonly evaluate: PositionEvaluator,
    private readonly random: RandomSource = Math.random,
  ) {}

  /**
   * Chooses the computer's ply for `state` (a `PlayState` with the computer
   * to move): reconciles the retained root against `state` (reuses it,
   * cloned, if it already describes the same position - the normal case,
   * since `commit`/`observe` keep the retained root in step with the game -
   * otherwise starts a fresh single-node working tree from `state`), runs
   * `min(B, max(0, 2*B - R))` new search iterations over that *working*
   * tree (`R` being the reused root's visit count before this call, `0` for a
   * fresh one - fixed decision 4), and returns the resulting most-visited
   * root child. The working tree is held as **pending** - not yet adopted as
   * the retained root - until a matching `commit` call. Does not itself apply
   * or validate the returned ply; the caller does that, through the rules
   * engine's `applyMove`, exactly as the play loop's `applyEnginePly` does
   * (`src/board/EngineGame.tsx`, story 00000021, Step 5).
   */
  async choose(state: PlayState): Promise<Ply> {
    const reusable =
      this.retainedRoot !== undefined &&
      statesMatch(this.retainedRoot.state, state);
    const root = reusable
      ? cloneTree(this.retainedRoot as SearchNode)
      : createSearchNode(state);

    const retainedVisits = root.visitCount;
    const iterations = Math.min(
      this.config.budget,
      Math.max(0, this.config.cap - retainedVisits),
    );

    await runSearch(
      root,
      iterations,
      this.evaluate,
      this.config.search,
      this.random,
    );

    const ply = mostVisitedPly(root, this.random);
    this.pendingRoot = root;
    return ply;
  }

  /**
   * Adopts the pending working tree built by the most recent `choose` call as
   * the new retained root, descended into `ply`'s child (discarding its
   * siblings) - the computer's own move having actually been played. Only
   * this call advances the retained tree forward from a `choose`; a
   * superseded/cancelled/StrictMode-doubled turn simply never calls `commit`,
   * so the pending working tree is dropped (garbage-collected) rather than
   * adopted, leaving the previously retained root untouched (fixed decision
   * 8). Throws if there is no pending working tree (`choose` was not called,
   * or this is a second `commit` for the same `choose`) or if `ply` does not
   * name one of the pending root's explored edges - both programming-
   * invariant violations, since the caller must always commit the very ply
   * `choose` just returned.
   */
  commit(ply: Ply): void {
    if (this.pendingRoot === undefined) {
      throw new Error(
        "SearchDriver.commit: no pending working tree - call choose() first.",
      );
    }
    const child = exploredChild(this.pendingRoot, ply);
    if (child === undefined) {
      throw new Error(
        "SearchDriver.commit: the committed ply was not an explored edge of the pending working tree - it must be the ply choose() just returned.",
      );
    }
    this.retainedRoot = child;
    this.pendingRoot = undefined;
  }

  /**
   * Descends the retained root into the child matching the human's `ply`
   * (discarding its siblings), or discards the retained tree entirely if
   * `ply` was never explored there (no edge, or an edge the search never
   * actually traversed) - the next `choose` then starts fresh from an empty
   * tree, per story.md's "Only when the human plays a ply the retained tree
   * never expanded... does the search start fresh." A no-op if there is no
   * retained root yet (nothing to descend).
   */
  observe(ply: Ply): void {
    if (this.retainedRoot === undefined) {
      return;
    }
    this.retainedRoot = exploredChild(this.retainedRoot, ply);
  }

  /**
   * Drops the retained tree and any pending working tree - "New game" (and
   * leaving the game outright) must never let a tree survive into the next
   * one, per story.md's "The tree never survives leaving the game or
   * starting a new one."
   */
  reset(): void {
    this.retainedRoot = undefined;
    this.pendingRoot = undefined;
  }

  /**
   * The retained root, or `undefined` if none - an inspection accessor for
   * tests (and future diagnostics), not part of the four operations above.
   * Callers must not mutate the returned node; only `choose`'s private
   * working-tree clone is ever searched.
   */
  getRetainedRoot(): SearchNode | undefined {
    return this.retainedRoot;
  }

  /**
   * The pending working tree built by the most recent uncommitted `choose`
   * call, or `undefined` if there is none (no `choose` since construction or
   * since the last `commit`) - an inspection accessor for tests, mirroring
   * `getRetainedRoot`.
   */
  getPendingRoot(): SearchNode | undefined {
    return this.pendingRoot;
  }
}
