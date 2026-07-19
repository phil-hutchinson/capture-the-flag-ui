// Piece tray / inventory panel (story 00000001, Step 8).
//
// Shows every one of the 8 piece types (rules 1.2's roster: six ranked types
// plus Tower and Flag - story 00000016) with its real icon (colored for the
// active player's side) and a live remaining count, driven by the
// placement-state model's derived `remaining` inventory (Step 3). Clicking a
// type with at least one remaining piece selects it (App.tsx then places the
// selected type on the next empty home square the player clicks on the
// board); clicking the already-selected type deselects it. A type with zero
// remaining is shown (so its full-army count is always visible) but
// disabled - there is nothing left of it to place.

import { PieceIcon } from "../art/PieceIcon.tsx";
import type { Side } from "../rules/primary/v1/board.ts";
import {
  pieceCatalogEntries,
  type Inventory,
  type PieceTypeId,
} from "../rules/primary/v1/pieces.ts";
import "./Tray.css";

export interface TrayProps {
  /** The active player's side, used to color the icons. */
  readonly side: Side;
  /** Remaining count per piece type (`PlacementState.remaining`). */
  readonly remaining: Inventory;
  /** The currently selected piece type, if any. */
  readonly selectedType: PieceTypeId | null;
  /** Called when a tray entry is clicked (selecting or deselecting it). */
  readonly onSelect: (type: PieceTypeId) => void;
}

/** The piece tray: one row per piece type, with icon, name, and remaining count. */
export function Tray({ side, remaining, selectedType, onSelect }: TrayProps) {
  return (
    <div className="tray" data-side={side}>
      {pieceCatalogEntries().map((entry) => {
        const count = remaining[entry.id];
        const isEmpty = count <= 0;
        const isSelected = selectedType === entry.id;
        const classNames = ["tray__item"];
        if (isSelected) {
          classNames.push("tray__item--selected");
        }
        if (isEmpty) {
          classNames.push("tray__item--empty");
        }

        return (
          <button
            key={entry.id}
            type="button"
            className={classNames.join(" ")}
            disabled={isEmpty}
            aria-pressed={isSelected}
            onClick={() => onSelect(entry.id)}
          >
            <PieceIcon
              type={entry.id}
              side={side}
              className="tray__item-icon"
            />
            <span className="tray__item-name">{entry.displayName}</span>
            <span className="tray__item-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
