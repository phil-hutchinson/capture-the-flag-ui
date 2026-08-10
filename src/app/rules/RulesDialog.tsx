// The "How to play" popup (story 00000032, Step 3): a native <dialog>
// carrying the full-width header and the six sections, in the two-column
// layout Decision 8 sets out. This step renders the text only - each
// section's figure ids are stood in for by plain placeholder boxes, so the
// column layout can be judged with realistic content before Steps 4 and 5
// replace them with real pictures (`RuleFigure.tsx`).
//
// The six sections are grouped into two DOM wrapper elements, one per
// `rulesCopy.ts` column, built with `sectionsInColumn` below rather than by
// pinning each section individually with `grid-column` - see
// `RulesDialog.css`'s header comment for why (a step-3 manual-gate defect:
// per-section `grid-column` left both columns sharing row-by-row
// auto-placement, which pushed the right column down to start beside the
// left column's last row instead of its first).
//
// Follows `LeaveGameDialog.tsx`'s established pattern for a native,
// `showModal()`-backed dialog: an `open` prop, a `useEffect` that opens or
// closes the underlying element to match it, `aria-labelledby` naming the
// dialog from its own heading, and the native (cancelable) `cancel` event -
// which fires on Escape - routed through the same `onClose` callback so the
// caller's `open` state stays the single source of truth for whether the
// popup is showing. Focus returning to the control that opened it (the
// "How to play" button) on close is the browser's own doing.
//
// Unlike `LeaveGameDialog`, which focuses its Cancel button, focus on open
// here goes to the popup's own `<h2>` title (Decision 9) via the same
// `tabIndex={-1}`-heading-focused-on-mount pattern `StartScreen.tsx` and
// `GameResult.tsx` use elsewhere - so a screen reader announces what the
// popup *is* before it announces the way out.
//
// `PieceSpriteDefs` (`src/art/PieceIcon.tsx`) is mounted here, as a sibling
// of the <dialog> in the returned fragment, even though nothing in this step
// draws a piece yet - Decision 4 puts it here so Step 4's `RuleFigure`s have
// the symbol library available without `StartScreen.tsx` needing to know
// about it.

import { useEffect, useRef } from "react";
import { PieceSpriteDefs } from "../../art/PieceIcon.tsx";
import {
  RULES_HEADER,
  RULES_SECTIONS,
  type RulesSection,
  type RulesSectionColumn,
} from "./rulesCopy.ts";
import "./RulesDialog.css";

/**
 * The sections belonging to one column, in DOM order. Built by filtering
 * `RULES_SECTIONS` on its own `column` field rather than assuming any
 * particular count per column, so a future edit to `rulesCopy.ts` (adding,
 * removing or re-columning a section) is reflected here automatically - see
 * `RulesDialog.css`'s header comment for why two DOM wrapper elements (one
 * per column), rather than per-section `grid-column` placement, are what
 * make the grid's own auto-placement put the left column at the top of the
 * right column too.
 */
function sectionsInColumn(column: RulesSectionColumn): readonly RulesSection[] {
  return RULES_SECTIONS.filter((section) => section.column === column);
}

export interface RulesDialogProps {
  /** Whether the "How to play" popup should be showing. */
  readonly open: boolean;
  /** Closes the popup; the caller's `open` state is the source of truth. */
  readonly onClose: () => void;
}

/** The "How to play" popup: a self-contained primer, native-<dialog>-backed. */
export function RulesDialog({ open, onClose }: RulesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      titleRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      <dialog
        ref={dialogRef}
        className="rules-dialog"
        aria-labelledby="rules-dialog-title"
        onCancel={(event) => {
          // Escape fires this cancelable native event just before the
          // dialog would close itself. Route it through `onClose`, exactly
          // as `LeaveGameDialog.tsx` does, so the caller's `open` state
          // stays authoritative rather than letting the browser close the
          // dialog out from under it.
          event.preventDefault();
          onClose();
        }}
      >
        <div className="rules-dialog__header">
          <div className="rules-dialog__header-text">
            <h2
              id="rules-dialog-title"
              tabIndex={-1}
              ref={titleRef}
              className="rules-dialog__title"
            >
              {RULES_HEADER.title}
            </h2>
            <p className="rules-dialog__header-line">{RULES_HEADER.lines[0]}</p>
            <p className="rules-dialog__header-line">{RULES_HEADER.lines[1]}</p>
          </div>
          <button
            type="button"
            className="rules-dialog__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="rules-dialog__sections">
          <div className="rules-dialog__column">
            {sectionsInColumn("left").map((section) => (
              <RulesSectionView key={section.id} section={section} />
            ))}
          </div>
          <div className="rules-dialog__column">
            {sectionsInColumn("right").map((section) => (
              <RulesSectionView key={section.id} section={section} />
            ))}
          </div>
        </div>
      </dialog>
      <PieceSpriteDefs />
    </>
  );
}

/** One section: its heading, body sentence and (placeholder, for now) figures. */
function RulesSectionView({ section }: { readonly section: RulesSection }) {
  return (
    <section className="rules-dialog__section">
      <h3 className="rules-dialog__section-heading">{section.heading}</h3>
      <p className="rules-dialog__section-body">{section.body}</p>
      <div className="rules-dialog__figures">
        {section.figureIds.map((figureId) => (
          // Placeholder only - Step 4 replaces this with a real
          // `RuleFigure`, driven by the same `figureId`. Marked
          // `aria-hidden` because it carries no content of its own yet; the
          // real figure will carry its own caption.
          <div
            key={figureId}
            className="rules-dialog__figure-placeholder"
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}
