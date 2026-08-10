// The "How to play" rules page (story 00000032). Steps 1-3 built this as a
// modal popup (`RulesDialog.tsx`); the owner then amended the story
// (story.md's Amendment 1) to make it a page instead, once Step 3 showed the
// modal fighting its own scroll region on a small screen. Step 4 converts it:
// this file was renamed from `RulesDialog.tsx` with `git mv` so its history
// survives, and the component below is a screen, not a dialog - see
// Decisions 8 and 9 in the implementation plan, which supersede everything
// Steps 1-3's frozen text says about a `<dialog>`.
//
// It joins `App.tsx`'s screen union exactly as `ImportScreen`/`ReviewScreen`
// do: a `<main className="app">`, a `tabIndex={-1}` `<h1>` focused on mount,
// and a plain `onBack` prop the shell turns into `setScreen({ kind: "start"
// })`. There is no confirmation prompt on leaving - following
// `ImportScreen`/`ReviewScreen`'s precedent, since nothing is lost by leaving
// a page of rules - and, per the owner's decision recorded in Decision 9,
// **two** identically labeled "Back to start" buttons: one right after the
// header lines, before the sections, and one at the foot of the page, after
// the sections region. Both call the same `onBack` and carry the same
// visible label; they are not disambiguated with differing `aria-label`s.
//
// The page scrolls as an ordinary document - no internal scroll region, no
// `max-height`, no focus trap, no Escape-to-close. That is the single reason
// the story moved off the modal, so nothing here reintroduces any of it.
//
// The six sections are grouped into two DOM wrapper elements, one per
// `rulesCopy.ts` column, built with `sectionsInColumn` below rather than by
// pinning each section individually with `grid-column` - carried over
// unchanged from Step 3's post-gate fix; see `RulesScreen.css`'s header
// comment for why (per-section `grid-column` left both columns sharing
// row-by-row auto-placement, which pushed the right column down to start
// beside the left column's last row instead of its first).
//
// `PieceSpriteDefs` (`src/art/PieceIcon.tsx`) is mounted here, as the first
// child of the `<main>`, exactly where `ReviewScreen.tsx` mounts its own
// copy - Steps 6 and 7 draw real pictures with it; nothing in this step draws
// a piece yet.

import { useEffect, useRef } from "react";
import { PieceSpriteDefs } from "../../art/PieceIcon.tsx";
import "../../App.css";
import {
  RULES_HEADER,
  RULES_SECTIONS,
  type RulesSection,
  type RulesSectionColumn,
} from "./rulesCopy.ts";
import "./RulesScreen.css";

/**
 * The sections belonging to one column, in DOM order. Built by filtering
 * `RULES_SECTIONS` on its own `column` field rather than assuming any
 * particular count per column, so a future edit to `rulesCopy.ts` (adding,
 * removing or re-columning a section) is reflected here automatically - see
 * `RulesScreen.css`'s header comment for why two DOM wrapper elements (one
 * per column), rather than per-section `grid-column` placement, are what
 * make the grid's own auto-placement put the left column at the top of the
 * right column too.
 */
function sectionsInColumn(column: RulesSectionColumn): readonly RulesSection[] {
  return RULES_SECTIONS.filter((section) => section.column === column);
}

export interface RulesScreenProps {
  /** Returns to the start screen. Never prompts - leaving a page of rules loses nothing. */
  readonly onBack: () => void;
}

/** The "How to play" rules page: a self-contained primer, reached only from the start screen. */
export function RulesScreen({ onBack }: RulesScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 tabIndex={-1} ref={titleRef} className="app__title">
        {RULES_HEADER.title}
      </h1>
      <div className="rules-screen__header-lines">
        <p className="rules-screen__header-line">{RULES_HEADER.lines[0]}</p>
        <p className="rules-screen__header-line">{RULES_HEADER.lines[1]}</p>
      </div>
      <button type="button" className="rules-screen__back" onClick={onBack}>
        Back to start
      </button>
      <div className="rules-screen__sections">
        <div className="rules-screen__column">
          {sectionsInColumn("left").map((section) => (
            <RulesSectionView key={section.id} section={section} />
          ))}
        </div>
        <div className="rules-screen__column">
          {sectionsInColumn("right").map((section) => (
            <RulesSectionView key={section.id} section={section} />
          ))}
        </div>
      </div>
      <button type="button" className="rules-screen__back" onClick={onBack}>
        Back to start
      </button>
    </main>
  );
}

/** One section: its heading, body sentence and (placeholder, for now) figures. */
function RulesSectionView({ section }: { readonly section: RulesSection }) {
  return (
    <section className="rules-screen__section">
      <h2 className="rules-screen__section-heading">{section.heading}</h2>
      <p className="rules-screen__section-body">{section.body}</p>
      <div className="rules-screen__figures">
        {section.figureIds.map((figureId) => (
          // Placeholder only - Step 6 replaces this with a real
          // `RuleFigure`, driven by the same `figureId`. Marked
          // `aria-hidden` because it carries no content of its own yet; the
          // real figure will carry its own caption.
          <div
            key={figureId}
            className="rules-screen__figure-placeholder"
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}
