// Review controls: step, jump (story 00000014, Step 11).
//
// Four plain buttons wired straight to `reviewSession.ts`'s pure cursor
// operations - jump to the opening position, step one move back, step one
// move forward, jump to the final position - placed directly beneath the
// board in the review screen's board column, the same slot
// `PlacementControls.tsx` occupies in the hot-seat layout. The review is
// watch-only (story.md): there is no "take over from here," no autoplay,
// nothing here mutates the record, only where the cursor points at it.
//
// "Back" and "Jump to start" are marked `aria-disabled` (and styled to look
// disabled) at the opening position; "Forward" and "Jump to end" the same at
// the final position - a keyboard/screen-reader user gets the same "there's
// nothing further that way" signal a sighted player reads from a disabled
// button. Deliberately *not* the native `disabled` attribute: a genuinely
// disabled button is dropped from the tab order, so stepping to either end
// of the game with Forward or Back focused would silently drop keyboard
// focus to `<body>`. `aria-disabled` keeps the button focusable and in the
// tab order while still announcing (and looking) unavailable; the session
// the buttons call into (`reviewSession.ts`) already clamps at both ends, so
// calling the handler there is always a harmless no-op.

import "./ReviewControls.css";

export interface ReviewControlsProps {
  /** True when the cursor is already at the opening position. */
  readonly isAtStart: boolean;
  /** True when the cursor is already at the final recorded position. */
  readonly isAtEnd: boolean;
  readonly onJumpToStart: () => void;
  readonly onStepBack: () => void;
  readonly onStepForward: () => void;
  readonly onJumpToEnd: () => void;
}

/** Jump-to-start / back / forward / jump-to-end - the review's only controls. */
export function ReviewControls({
  isAtStart,
  isAtEnd,
  onJumpToStart,
  onStepBack,
  onStepForward,
  onJumpToEnd,
}: ReviewControlsProps) {
  return (
    <div className="review-controls">
      <button
        type="button"
        className="review-controls__button"
        onClick={onJumpToStart}
        aria-disabled={isAtStart}
      >
        Jump to start
      </button>
      <button
        type="button"
        className="review-controls__button"
        onClick={onStepBack}
        aria-disabled={isAtStart}
      >
        Back
      </button>
      <button
        type="button"
        className="review-controls__button"
        onClick={onStepForward}
        aria-disabled={isAtEnd}
      >
        Forward
      </button>
      <button
        type="button"
        className="review-controls__button"
        onClick={onJumpToEnd}
        aria-disabled={isAtEnd}
      >
        Jump to end
      </button>
    </div>
  );
}
