// The import screen: choose a recorded game file to review (story
// 00000014). Step 8 landed only the screen's shell - a heading and the way
// back to the start screen; this step (Step 9) fills in the file picker,
// reads the chosen file in the browser (`File.text()` - nothing is
// uploaded, the app has no backend), passes its text to `readRecord.ts`, and
// either shows a player-facing rejection message or hands the fully
// replayed game on to the review screen.
//
// Rejection is a player-facing moment, not a stack trace (story.md): the
// message - built by `reviewText.ts`'s `describeRejection` from the reader's
// structured error - is pushed into an *assertive* live region
// (`role="alert"`) so it is announced, not just shown, and the screen stays
// usable so a different file can be chosen straight away. Following
// `PlayWarnings.tsx`'s established precedent, the live-region element stays
// mounted at all times (its text simply changes) rather than being mounted
// only once there is something to say - toggling a live region in and out of
// the DOM risks the first announcement inside it being missed.
//
// The file input carries no `accept` filter: Gate C requires that a player
// *can* choose the wrong kind of file (e.g. a photo) and have it rejected
// with a clear message, which a narrow `accept` filter could get in the way
// of by hiding it from the picker.
//
// Focus moves to the heading on mount, the same pattern `StartScreen.tsx`
// uses, so a keyboard or screen-reader user arriving here (or returning to
// it to try a different file) is not stranded on `<body>`.

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "../App.css";
import "./ImportScreen.css";
import { readRecord } from "../rules/readRecord.ts";
import type { ReplayedRecord } from "../rules/primary/v1_1/replay.ts";
import { describeRejection } from "./reviewText.ts";

/**
 * A simple ceiling against a pathologically large file (e.g. a stray photo
 * or video chosen by mistake): a real game record - even a very long game -
 * is at most a few hundred kilobytes of text, so 5 MB is generous headroom
 * while still guarding against reading something enormous into memory.
 */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Shown when reading the chosen file itself fails - the file was moved or
 * deleted after the picker opened, a permission or I/O error, a directory
 * dropped in on some platforms - as opposed to the file being read fine but
 * not a record this app can review (`describeRejection` handles that case).
 */
const UNREADABLE_FILE_MESSAGE =
  "This file couldn't be read. Try choosing it again.";

export interface ImportScreenProps {
  /** Returns to the start screen without choosing a file. */
  readonly onBack: () => void;
  /** Navigates to the review screen with a successfully replayed game. */
  readonly onImported: (record: ReplayedRecord) => void;
}

export function ImportScreen({ onBack, onImported }: ImportScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function readChosenFile(file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        "This file is much larger than a game record should ever be, so it can't be reviewed.",
      );
      return;
    }

    try {
      const text = await file.text();
      const result = readRecord(text);
      if (result.kind === "error") {
        setError(describeRejection(result.error));
        return;
      }

      setError(null);
      onImported(result.record);
    } catch {
      setError(UNREADABLE_FILE_MESSAGE);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so choosing the very same file again (e.g. after
    // fixing it, or simply retrying) still fires this handler - browsers do
    // not fire `change` a second time for an unchanged selection otherwise.
    event.target.value = "";
    if (file === undefined) {
      return;
    }
    // Belt and suspenders: `readChosenFile` already catches everything it
    // can, but nothing here should ever let a rejection escape unhandled.
    readChosenFile(file).catch(() => {
      setError(UNREADABLE_FILE_MESSAGE);
    });
  }

  return (
    <main className="app">
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        Review a game
      </h1>
      <p className="import-screen__explanation">
        Nothing is uploaded — the file is read on your device.
      </p>
      <div className="import-screen__picker">
        <label className="import-screen__label" htmlFor="import-screen-file">
          Choose a game file
        </label>
        <input
          id="import-screen-file"
          className="import-screen__file-input"
          type="file"
          onChange={handleFileChange}
        />
      </div>
      <p className="import-screen__error" role="alert">
        {error ?? ""}
      </p>
      <button type="button" className="import-screen__back" onClick={onBack}>
        Back
      </button>
    </main>
  );
}
