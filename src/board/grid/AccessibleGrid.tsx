// Generic, piece-agnostic accessible grid (story 00000004, Step 5).
//
// Implements the WAI-ARIA grid composite-widget pattern generically enough
// for both Phase 2 movement (this story, via a future PlayBoard) and, later,
// story 00000002's Phase 1 placement to adopt without a rewrite: a
// `role="grid"` container of `role="row"` rows of `role="gridcell"` cells,
// roving tabindex (exactly one cell tabbable at a time, the rest `-1`),
// arrow-key navigation driven by the pure `nextFocusPosition`
// (./gridNavigation.ts), Enter/Space activation, and a polite ARIA live
// region the consumer drives via the `announcement` prop.
//
// This component knows nothing about pieces, sides, movement, or board
// orientation - only about a 2-D array of `GridCellDescriptor`s (rendered
// content + accessible label + focusable/actionable flags) and an
// activation callback keyed by `{ row, column }` grid position. Consumers
// map their own domain coordinates onto this generic `row`/`column` index
// space.
//
// Its ARIA roles, roving tabindex, keyboard handling, and live-region
// behavior are exercised manually (story 00000004 Gate D / Step 9) — the
// project's Vitest environment is `node` only (no jsdom / component-testing
// library), so only the pure navigation math (gridNavigation.test.ts) is
// automated here; see
// doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md
// for the deferred automated-coverage story.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  firstFocusablePosition,
  nextFocusPosition,
  type ArrowKey,
  type GridPosition,
} from "./gridNavigation.ts";
import "./AccessibleGrid.css";

/** One cell's rendered content and accessibility/interaction flags. */
export interface GridCellDescriptor {
  /** Rendered inside the cell (an icon, empty, etc). */
  readonly content?: ReactNode;
  /** Accessible name for the cell, read by assistive technology. */
  readonly label: string;
  /** Whether this cell takes part in roving-tabindex keyboard focus. */
  readonly focusable: boolean;
  /** Whether Enter/Space/click on this cell calls `onActivate`. */
  readonly actionable: boolean;
}

export interface AccessibleGridProps {
  /** Accessible name for the grid as a whole (`aria-label`). */
  readonly label: string;
  /** Cell descriptors in screen order: `rows[row][column]`. Must be rectangular. */
  readonly rows: readonly (readonly GridCellDescriptor[])[];
  /** Called with the grid position of a cell when it is activated (Enter/Space/click), if actionable. */
  readonly onActivate: (position: GridPosition) => void;
  /**
   * Text pushed into the grid's polite live region, e.g. "Selected
   * Foot Soldier at D5. 6 legal destinations." The consumer owns the wording
   * and updates it on every screen-reader-relevant change.
   */
  readonly announcement?: string;
  readonly className?: string;
}

const ARROW_KEYS: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isArrowKey(key: string): key is ArrowKey {
  return ARROW_KEYS.has(key);
}

function positionKey(position: GridPosition): string {
  return `${position.row},${position.column}`;
}

/**
 * Generic accessible grid: ARIA roles, roving tabindex, arrow-key
 * navigation, Enter/Space activation, and a live region — see the module
 * comment above for the full contract.
 */
export function AccessibleGrid({
  label,
  rows,
  onActivate,
  announcement,
  className,
}: AccessibleGridProps) {
  const rowCount = rows.length;
  const columnCount = rowCount > 0 ? rows[0].length : 0;

  const isFocusable = useCallback(
    (position: GridPosition): boolean =>
      rows[position.row]?.[position.column]?.focusable ?? false,
    [rows],
  );

  const [focused, setFocused] = useState<GridPosition | undefined>(() =>
    firstFocusablePosition(rowCount, columnCount, isFocusable),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());

  // Keep the roving-tabindex target valid if the descriptors change shape
  // between renders (e.g. legal destinations change after a selection) and
  // the previously focused cell has stopped being focusable.
  useEffect(() => {
    if (focused !== undefined && isFocusable(focused)) {
      return;
    }
    setFocused(firstFocusablePosition(rowCount, columnCount, isFocusable));
    // `isFocusable` is a fresh closure each render (it reads `rows`), so
    // this effect re-checks on every render; harmless, since it only calls
    // `setFocused` when the currently focused cell has actually stopped
    // being focusable.
  }, [rows, rowCount, columnCount, focused, isFocusable]);

  // Move real DOM focus to follow the roving-tabindex target, but only when
  // focus is already inside this grid - never steal focus on mount or when
  // the descriptors change while focus is elsewhere on the page.
  useEffect(() => {
    if (focused === undefined) {
      return;
    }
    const container = containerRef.current;
    if (!container || !container.contains(document.activeElement)) {
      return;
    }
    cellRefs.current.get(positionKey(focused))?.focus();
  }, [focused]);

  function activate(position: GridPosition) {
    const descriptor = rows[position.row]?.[position.column];
    if (descriptor?.actionable) {
      onActivate(position);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (focused === undefined) {
      return;
    }
    if (isArrowKey(event.key)) {
      event.preventDefault();
      const next = nextFocusPosition({
        rowCount,
        columnCount,
        current: focused,
        key: event.key,
        isFocusable,
      });
      if (next.row !== focused.row || next.column !== focused.column) {
        setFocused(next);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(focused);
    }
  }

  const classNames = ["accessible-grid"];
  if (className) {
    classNames.push(className);
  }

  return (
    // The live region is a *sibling* of the `role="grid"` element, not a
    // child: a `grid` may only own `row`/`rowgroup` elements, so a
    // `role="status"` child is an ARIA structural violation. The wrapper is
    // `display: contents` (see AccessibleGrid.css) so it adds no box and
    // layout is unchanged - the grid still lays out exactly as before.
    <div className="accessible-grid__wrapper">
      <div
        ref={containerRef}
        className={classNames.join(" ")}
        role="grid"
        aria-label={label}
        onKeyDown={handleKeyDown}
      >
        {rows.map((rowCells, rowIndex) => (
          <div className="accessible-grid__row" role="row" key={rowIndex}>
            {rowCells.map((cell, columnIndex) => {
              const position: GridPosition = {
                row: rowIndex,
                column: columnIndex,
              };
              const isFocused =
                focused !== undefined &&
                focused.row === rowIndex &&
                focused.column === columnIndex;
              const cellClassNames = ["accessible-grid__cell"];
              if (isFocused) {
                cellClassNames.push("accessible-grid__cell--focused");
              }
              return (
                <div
                  key={columnIndex}
                  ref={(element) => {
                    const key = positionKey(position);
                    if (element) {
                      cellRefs.current.set(key, element);
                    } else {
                      cellRefs.current.delete(key);
                    }
                  }}
                  className={cellClassNames.join(" ")}
                  role="gridcell"
                  aria-label={cell.label}
                  tabIndex={cell.focusable ? (isFocused ? 0 : -1) : undefined}
                  onClick={
                    cell.actionable
                      ? () => {
                          if (cell.focusable) {
                            setFocused(position);
                          }
                          activate(position);
                        }
                      : undefined
                  }
                >
                  {cell.content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div
        className="accessible-grid__live-region"
        role="status"
        aria-live="polite"
      >
        {announcement}
      </div>
    </div>
  );
}
