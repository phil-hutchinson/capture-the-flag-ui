// Pure navigation math for the reusable accessible grid (story 00000004,
// Step 5; extended by story 00000002, Step 2, with `resolveInitialFocus` so a
// consumer can seed the grid's initial roving-tabindex target). This module
// knows nothing about pieces, sides, movement, board orientation, or React -
// it is generic 2-D grid geometry so it can be unit tested in the project's
// `node` Vitest environment (no jsdom) and reused by any consumer of the
// WAI-ARIA grid pattern (story 00000004's Phase 2 board, and story
// 00000002's Phase 1 placement board).
//
// Positions are `{ row, column }` zero-based indices into a rectangular grid
// of `rowCount` rows by `columnCount` columns - screen order, not any
// game-domain coordinate system. The consuming component maps its own
// row/column arrays onto these indices.

/** The four arrow keys the grid responds to (matches `KeyboardEvent.key`). */
export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** A zero-based cell position in screen order: row 0 is topmost, column 0 leftmost. */
export interface GridPosition {
  readonly row: number;
  readonly column: number;
}

/** Row/column step applied by each arrow key, in screen space. */
const ARROW_DELTA: Readonly<
  Record<ArrowKey, { readonly rowStep: number; readonly columnStep: number }>
> = {
  ArrowUp: { rowStep: -1, columnStep: 0 },
  ArrowDown: { rowStep: 1, columnStep: 0 },
  ArrowLeft: { rowStep: 0, columnStep: -1 },
  ArrowRight: { rowStep: 0, columnStep: 1 },
};

export interface NextFocusPositionArgs {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly current: GridPosition;
  readonly key: ArrowKey;
  /** Whether a given position may receive keyboard focus. */
  readonly isFocusable: (position: GridPosition) => boolean;
}

/**
 * Computes the next focused position for an arrow-key press.
 *
 * Skip policy: stepping in the pressed direction, the nearest **focusable**
 * cell is chosen - non-focusable cells (e.g. a lake, or any cell the
 * consumer marks unfocusable) are skipped over rather than stopping
 * navigation. If the edge of the grid is reached before any focusable cell
 * is found, focus does not move at all (the current position is returned
 * unchanged) - this is what makes navigation clamp at edges with no
 * wraparound and never gets trapped: a cell that is off-board is never
 * returned, and a press that finds nothing focusable simply has no effect
 * rather than leaving focus on a non-focusable cell.
 */
export function nextFocusPosition({
  rowCount,
  columnCount,
  current,
  key,
  isFocusable,
}: NextFocusPositionArgs): GridPosition {
  const { rowStep, columnStep } = ARROW_DELTA[key];
  let row = current.row;
  let column = current.column;

  for (;;) {
    row += rowStep;
    column += columnStep;
    if (row < 0 || row >= rowCount || column < 0 || column >= columnCount) {
      // Ran off the grid without finding a focusable cell: clamp - stay put.
      return current;
    }
    const candidate: GridPosition = { row, column };
    if (isFocusable(candidate)) {
      return candidate;
    }
  }
}

/**
 * The first focusable position in row-major (top-to-bottom, left-to-right)
 * order, or `undefined` if no cell is focusable. Used to pick the grid's
 * initial roving-tabindex target, and as a fallback if the previously
 * focused cell stops being focusable (e.g. the consumer's descriptors
 * change shape between renders).
 */
export function firstFocusablePosition(
  rowCount: number,
  columnCount: number,
  isFocusable: (position: GridPosition) => boolean,
): GridPosition | undefined {
  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < columnCount; column++) {
      const candidate: GridPosition = { row, column };
      if (isFocusable(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

export interface ResolveInitialFocusArgs {
  /**
   * The consumer's preferred initial roving-tabindex target (story
   * 00000002's placement board wants the first home-band square rather than
   * `firstFocusablePosition`'s row-major scan, since the non-interactive
   * lake/buffer bands sit above it). Omit to keep today's default.
   */
  readonly preferred?: GridPosition;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly isFocusable: (position: GridPosition) => boolean;
}

/**
 * Chooses the grid's **initial** roving-tabindex target: `preferred` if it is
 * in bounds and focusable, otherwise `firstFocusablePosition`'s row-major
 * scan - the same fallback used today when no preference is supplied at all,
 * so a consumer that never passes `preferred` sees no change in behaviour.
 * This is initial-only guidance; it says nothing about what happens on later
 * renders (that remains `firstFocusablePosition`, used directly by the
 * caller when the previously focused cell stops being focusable).
 */
export function resolveInitialFocus({
  preferred,
  rowCount,
  columnCount,
  isFocusable,
}: ResolveInitialFocusArgs): GridPosition | undefined {
  if (
    preferred !== undefined &&
    preferred.row >= 0 &&
    preferred.row < rowCount &&
    preferred.column >= 0 &&
    preferred.column < columnCount &&
    isFocusable(preferred)
  ) {
    return preferred;
  }
  return firstFocusablePosition(rowCount, columnCount, isFocusable);
}
