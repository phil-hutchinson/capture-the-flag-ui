// Web Worker host for the PUCT search (story 00000021, Step 3). Owns the
// onnxruntime session (`inference.ts`) AND the retained search tree
// (`SearchDriver`, Step 2) - the tree never crosses the message boundary
// (fixed decision 2): only small structured-cloneable messages are exchanged
// with the main thread - `PlayState`s, `Ply`s (`{ from, to }`), the driver's
// config, and control signals.
//
// Instantiated by the main thread (`searchClient.ts`) via Vite's
// module-worker form - `new Worker(new URL("./searchWorker.ts",
// import.meta.url), { type: "module" })` (fixed decision 1) - which lets Vite
// bundle this file's whole dependency graph, including onnxruntime-web and
// its `?url` WASM/`.mjs` assets, for both `npm run dev` and the static
// `dist/` build.
//
// `tsconfig.app.json`'s `lib` is `["ES2022", "DOM", "DOM.Iterable"]` (no
// `WebWorker`), since the rest of the app runs on the main thread; this file
// alone needs the worker globals (`self`, `postMessage`, `onmessage`),
// brought in with the triple-slash directive below rather than a dedicated
// tsconfig, per the implementation plan's Orienting facts - this compiled
// cleanly alongside the app's existing `DOM` lib when tried at Step 3.

/// <reference lib="webworker" />

import type { Ply } from "../encoding/eng-nn-1/decoder.ts";
import type { PlayState } from "../rules/primary/v2/play.ts";
import { evaluatePosition } from "./inference.ts";
import { SearchDriver, type SearchDriverConfig } from "./searchDriver.ts";

/**
 * Every message the proxy client (`searchClient.ts`) can post to this
 * worker. `requestId` on `choose` lets the proxy match this worker's
 * eventual `chosen`/`error` reply back to the `choosePly` call that sent it.
 */
export type SearchWorkerRequest =
  | { readonly type: "init"; readonly config: SearchDriverConfig }
  | {
      readonly type: "choose";
      readonly requestId: number;
      readonly state: PlayState;
    }
  | { readonly type: "commit"; readonly ply: Ply }
  | { readonly type: "observe"; readonly ply: Ply }
  | { readonly type: "reset" };

/** Every message this worker can post back to the proxy client, tagged with the `choose` request it answers. */
export type SearchWorkerResponse =
  | { readonly type: "chosen"; readonly requestId: number; readonly ply: Ply }
  | {
      readonly type: "error";
      readonly requestId: number;
      readonly message: string;
    };

// The one `SearchDriver` instance this worker hosts, wired with the real
// `evaluatePosition` (WASM inference lives here, off the main thread) -
// `undefined` until the proxy's `init` message supplies the difficulty's
// config. A `reset` message clears the driver's own retained/pending trees
// (`SearchDriver.reset`), not this reference: the driver itself, and the
// warm onnxruntime session inside `evaluatePosition`, live for the worker's
// whole lifetime (fixed decision 9's "keeping the session warm").
let driver: SearchDriver | undefined;

self.onmessage = (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data;
  switch (message.type) {
    case "init": {
      driver = new SearchDriver(message.config, evaluatePosition);
      return;
    }
    case "choose": {
      void handleChoose(message.requestId, message.state);
      return;
    }
    case "commit": {
      driver?.commit(message.ply);
      return;
    }
    case "observe": {
      driver?.observe(message.ply);
      return;
    }
    case "reset": {
      driver?.reset();
      return;
    }
  }
};

/**
 * Runs the driver's `choose` for `state` and posts back the chosen ply (or a
 * stringified error) tagged with `requestId`. Several `choose` calls could,
 * in principle, be in flight at once from the proxy's perspective (though the
 * play loop only ever keeps one outstanding), so this never blocks handling
 * of other messages - `self.onmessage` fires it and returns immediately.
 */
async function handleChoose(
  requestId: number,
  state: PlayState,
): Promise<void> {
  if (driver === undefined) {
    postResponse({
      type: "error",
      requestId,
      message: "SearchWorker: received 'choose' before 'init'.",
    });
    return;
  }
  try {
    const ply = await driver.choose(state);
    postResponse({ type: "chosen", requestId, ply });
  } catch (error) {
    postResponse({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function postResponse(response: SearchWorkerResponse): void {
  self.postMessage(response);
}
