// Piece tray / inventory panel (story 00000001, Step 8).
//
// Shows one row per piece type in the active army's roster (rules §2.2:
// Battle's 8 types; Skirmish's roster omits Foot Soldier and Militia
// entirely - story 00000023's Step 4) with its real icon (colored for the
// active player's side) and a live remaining count, driven by the
// placement-state model's derived `remaining` inventory (Step 3). Clicking a
// type with at least one remaining piece selects it (App.tsx then places the
// selected type on the next empty home square the player clicks on the
// board); clicking the already-selected type deselects it. A type with zero
// *remaining* pieces (but a nonzero roster count) is still shown - so its
// full-army count is always visible - but disabled, since there is nothing
// left of it to place; a type with a zero roster count (never fielded by
// this army) is not shown at all.

import { PieceIcon } from "../art/PieceIcon.tsx";
import type { Side } from "../rules/primary/v2/board.ts";
import type { ArmyRoster } from "../rules/primary/v2/armyComposition.ts";
import {
  pieceCatalogEntries,
  type Inventory,
  type PieceTypeId,
} from "../rules/primary/v2/pieces.ts";
import "./Tray.css";

export interface TrayProps {
  /** The active player's side, used to color the icons. */
  readonly side: Side;
  /** The active army's roster (`PlacementState.army`) - which types it fields at all. */
  readonly army: ArmyRoster;
  /** Remaining count per piece type (`PlacementState.remaining`). */
  readonly remaining: Inventory;
  /** The currently selected piece type, if any. */
  readonly selectedType: PieceTypeId | null;
  /** Called when a tray entry is clicked (selecting or deselecting it). */
  readonly onSelect: (type: PieceTypeId) => void;
}

/** The piece tray: one row per piece type this army fields, with icon, name, and remaining count. */
export function Tray({
  side,
  army,
  remaining,
  selectedType,
  onSelect,
}: TrayProps) {
  return (
    <div className="tray" data-side={side}>
      {pieceCatalogEntries()
        .filter((entry) => army[entry.id] > 0)
        .map((entry) => {
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
