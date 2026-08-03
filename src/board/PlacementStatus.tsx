// Placement status bar: whose turn it is, progress, auto-fill, and confirm
// (story 00000001, Step 10).
//
// This is the session-level action row, distinct from PlacementControls
// (which acts on a single selected/placed piece). It shows the active
// player's own color (never the internal "White"/"Black" turn-order labels -
// see story.md's "Players and colors"), a live "N / total placed" readout
// (Step 3's `progress`) - placement is sparse under rules major 2, so a
// complete army fills only some of the player's home squares (the edition's
// army size versus its home-zone size) and the rest stay empty, which is
// expected, not an error - a one-click auto-fill/randomize button
// (Step 4's `autoFill`), and the Confirm action that both stores the active
// player's layout and hands off to the next player.
//
// Story 00000016, Step 6: Confirm stays disabled until the active player's
// army is both complete *and* satisfies the Tower-placement rules (rules
// §3). Story 00000025 widened those rules from spacing alone to (on a
// `spacing_and_lanes` edition) spacing-or-lane, and replaced the boolean
// `towerAdjacencyBlocked` prop with `towerMessage`: a single string, already
// resolved by the caller (`towerPlacementMessages.ts`'s
// `towerLiveRegionMessage`, per the plan's "Decisions resolved at plan time",
// item 4) according to one precedence - a drop-time refusal, if one just
// happened; otherwise the "Towers can't go on …" hint while a Tower is in
// hand; otherwise the confirm-time block explanation (spacing or lane);
// otherwise `""`. This component only ever renders whatever string it is
// given - it does not itself know which of those four cases produced it.
//
// Story 00000016, Step 9 (accessibility pass): the warning's wrapping
// `role="status"` element stays mounted at all times - even when
// `towerMessage` is `""` and it renders no text - following
// `PlayWarnings.tsx`'s established live-region pattern, so assistive
// technology has already registered it as a live region before the first
// message ever appears. Toggling the whole element in and out of the DOM (as
// an earlier version of this component did) risks the first announcement
// being missed - story 00000025's Step 5 keeps this element exactly as it
// is, for the same reason.

import type { Side } from "../rules/primary/v2/board.ts";
import type { PlacementProgress } from "../rules/primary/v2/placement.ts";
import { sideColorName } from "./sideNames.ts";
import type { TowerLiveRegionMessage } from "./towerPlacementMessages.ts";
import "./PlacementStatus.css";

export interface PlacementStatusProps {
  /** The active player's side, used only to pick the color name shown. */
  readonly side: Side;
  readonly progress: PlacementProgress;
  /** Whether the active player's army is complete (Confirm is enabled only then). */
  readonly canConfirm: boolean;
  /**
   * The one live-region message to show right now (story 00000025, Step 5),
   * or `""` for none - already resolved by the caller
   * (`towerLiveRegionMessage`) according to the precedence described above.
   * Replaces the old boolean `towerAdjacencyBlocked`, which only ever covered
   * the confirm-time spacing case. Carries a `seq` token (peer review finding
   * #5) so the caller can force a fresh announcement even when refusing the
   * same square twice in a row produces identical text - used as the
   * message `<p>`'s `key` below, so a new `seq` always mounts a fresh DOM
   * node for assistive tech to notice.
   */
  readonly towerMessage: TowerLiveRegionMessage;
  /** Fills every remaining empty square with the active player's remaining pieces. */
  readonly onAutoFill: () => void;
  /** Stores the active player's layout and hands off to the next player. */
  readonly onConfirm: () => void;
}

export function PlacementStatus({
  side,
  progress,
  canConfirm,
  towerMessage,
  onAutoFill,
  onConfirm,
}: PlacementStatusProps) {
  return (
    <div className="placement-status" data-side={side}>
      <span className="placement-status__side">
        {sideColorName(side)}'s turn to place their army
      </span>
      <span className="placement-status__progress">
        {progress.placed} / {progress.total} placed
      </span>
      <button
        type="button"
        onClick={onAutoFill}
        disabled={progress.placed >= progress.total}
      >
        Auto-fill
      </button>
      <button
        type="button"
        className="placement-status__confirm"
        onClick={onConfirm}
        disabled={!canConfirm}
      >
        Confirm
      </button>
      <div
        className="placement-status__tower-warning-region"
        role="status"
        aria-live="polite"
      >
        {towerMessage.text && (
          <p key={towerMessage.seq} className="placement-status__tower-warning">
            {towerMessage.text}
          </p>
        )}
      </div>
    </div>
  );
}
