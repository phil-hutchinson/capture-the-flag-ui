// Countdown warning banner.
//
// Renders `playWarnings.ts`'s `CountdownWarnings` - the single shared
// inactivity warning sentence, if in effect - in the status area, above the
// board, alongside `PlayStatus`. Never covers the board.
//
// This is its **own** polite live region (`role="status"
// aria-live="polite"`), deliberately separate from the board's existing live
// region (AccessibleGrid.tsx / playAnnouncement.ts): a countdown is
// independent of the move narrative and would bloat every move sentence if
// folded in there. Unlike the board's live region (which is visually
// hidden), this one is fully visible - the sentence text itself is the
// primary, always-legible signal, so it is perceivable without relying on
// color alone; any accent styling below is additional, never the only cue.
//
// The wrapping element stays mounted at all times (even with nothing to
// show, when it renders no children and so takes up no visible space) so
// that assistive technology has already registered it as a live region
// before a warning first appears - toggling the whole element in and out of
// the DOM risks the first announcement being missed.

import type { CountdownWarnings } from "./playWarnings.ts";
import "./PlayWarnings.css";

export interface PlayWarningsProps {
  readonly warnings: CountdownWarnings;
}

/** The countdown warning banner: the inactivity warning sentence, if in effect. */
export function PlayWarnings({ warnings }: PlayWarningsProps) {
  const { inactivity } = warnings;

  return (
    <div className="play-warnings" role="status" aria-live="polite">
      {inactivity !== null && (
        <p className="play-warnings__item play-warnings__item--inactivity">
          <span className="play-warnings__label">Warning:</span>{" "}
          {inactivity.message}
        </p>
      )}
    </div>
  );
}
