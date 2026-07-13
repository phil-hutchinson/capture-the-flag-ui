// The import screen: choose a recorded game file to review (story
// 00000014). Step 8 lands only the screen's shell - a heading and the way
// back to the start screen - so the start screen and the app shell can be
// verified on their own (Gate A, part 1); Step 9 fills in the file picker,
// reads the chosen file, shows a rejection message when it can't be
// reviewed, and hands a successfully replayed game to the review screen.
//
// Focus moves to the heading on mount, the same pattern `StartScreen.tsx`
// uses, so a keyboard or screen-reader user arriving here (or returning to
// it to try a different file) is not stranded on `<body>`.

import { useEffect, useRef } from "react";
import "../App.css";
import "./ImportScreen.css";

export interface ImportScreenProps {
  /** Returns to the start screen without choosing a file. */
  readonly onBack: () => void;
}

export function ImportScreen({ onBack }: ImportScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="app">
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        Review a game
      </h1>
      <button type="button" className="import-screen__back" onClick={onBack}>
        Back
      </button>
    </main>
  );
}
