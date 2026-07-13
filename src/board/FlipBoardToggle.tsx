// "Flip board between turns" toggle (story 00000012, Step 3).
//
// Controlled component: `App.tsx` owns the boolean (in-memory for now;
// persisted starting Step 4) and passes it straight in, alongside a change
// handler. This component renders it and reports changes back - it never
// reads or writes local storage itself, keeping the persistence seam (Step
// 1's `flipBoardSetting.ts`) entirely in `App.tsx`.
//
// Built on a native `<input type="checkbox">` with an *explicit* `htmlFor`/
// `id` association to its `<label>` (owner's presentation review, story
// 00000012 Step 3), rather than relying on an implicit wrapping label: this
// is the more robust association for assistive technology, and it lets the
// two elements sit in DOM order checkbox-then-label - "[ ] Flip board
// between turns" - matching the owner's requested reading order. `useId`
// keeps the generated id collision-free even if this component were ever
// rendered more than once. The label text stays fixed to exactly "Flip
// board between turns" (the owner's wording) so the accessible name never
// changes shape between the two states.
//
// The on/off state must also be perceivable *without* relying on color
// alone (story in-scope item 5). Per the owner's review, the checkbox's own
// checked/unchecked appearance (a track/knob switch, `::before` on the
// input, styled in FlipBoardToggle.css - the knob's position and the
// track's fill both change) is that non-color signal; there is no separate
// text affordance, since the control's own state already carries it and a
// screen reader announces the native checked/unchecked state on its own.

import { useId } from "react";

export interface FlipBoardToggleProps {
  /** The current "flip board between turns" setting: `true` is today's flip-at-hand-off behavior, `false` is red's perspective, always. */
  readonly flipBetweenTurns: boolean;
  /** Called with the new value whenever the player toggles the switch. */
  readonly onChange: (flipBetweenTurns: boolean) => void;
}

/**
 * The "Flip board between turns" switch: a native checkbox styled as an
 * on/off track, explicitly associated with its label so its accessible name
 * and checked state are always conveyed together.
 */
export function FlipBoardToggle({
  flipBetweenTurns,
  onChange,
}: FlipBoardToggleProps) {
  const inputId = useId();
  return (
    <span className="flip-board-toggle">
      <input
        id={inputId}
        type="checkbox"
        className="flip-board-toggle__input"
        checked={flipBetweenTurns}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={inputId} className="flip-board-toggle__label">
        Flip board between turns
      </label>
    </span>
  );
}
