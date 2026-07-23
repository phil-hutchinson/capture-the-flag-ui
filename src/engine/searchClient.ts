// Main-thread proxy client for the Web Worker-hosted PUCT search (story
// 00000021, Step 3). The play loop (Step 5) will talk to this class exactly
// as it would to a synchronous in-process object; every call underneath is a
// `postMessage` round-trip to `searchWorker.ts`, which owns the onnxruntime
// session, the search, and the retained tree (fixed decisions 1-2). This
// class never runs the search or inference itself - the main thread does no
// per-iteration work (story.md's "Keeping the UI responsive").
//
// Constructing this class creates the worker via Vite's module-worker form
// (fixed decision 1); the caller owns the resulting instance's lifetime
// (a `useRef` in `EngineGame.tsx`, Step 5) and must call `terminate()` when
// the game is left, so the worker - and any tree it holds - is destroyed
// outright (fixed decision 9). `reset()` is the lighter-weight "New game"
// equivalent: it clears the worker's retained/pending trees but keeps the
// worker (and its warm onnxruntime session) alive.

import type { Ply } from "../encoding/eng-nn-1/decoder.ts";
import type { PlayState } from "../rules/primary/v1/play.ts";
import type { SearchDriverConfig } from "./searchDriver.ts";
import type {
  SearchWorkerRequest,
  SearchWorkerResponse,
} from "./searchWorker.ts";

/** One `choosePly` call awaiting its worker reply, matched by `requestId`. */
interface PendingChoice {
  readonly resolve: (ply: Ply) => void;
  readonly reject: (error: Error) => void;
}

/**
 * The main-thread half of the worker boundary: owns the `Worker` instance,
 * sends it the difficulty's config, and exposes the driver's four operations
 * (`choosePly`/`commit`/`observe`/`reset`) plus `terminate`. `choosePly` is
 * the only round-trip that waits for a reply (a real search runs in the
 * worker before it answers); `commit`/`observe`/`reset` are fire-and-forget,
 * exactly as `SearchDriver`'s own synchronous methods are - the worker
 * applies them without this class waiting for an acknowledgement.
 */
export class SearchClient {
  private readonly worker: Worker;
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingChoice>();

  /** Creates the worker (Vite's module-worker form) and sends it `config` as its `init` message. */
  constructor(config: SearchDriverConfig) {
    this.worker = new Worker(new URL("./searchWorker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      this.rejectAllPending(
        event.message === "" ? "SearchClient: worker error." : event.message,
      );
    };
    this.post({ type: "init", config });
  }

  /**
   * Asks the worker to search from `state` (the computer to move) and
   * resolves with its chosen ply once the reply arrives - a genuine search,
   * so this can take a while at higher difficulties; the caller (Step 5) runs
   * this alongside a "the computer is thinking" state exactly as
   * `chooseEnginePly` was. Rejects if the worker reports an error (e.g. the
   * WASM model failed to load) or if the worker itself errors out or is
   * terminated with this request still in flight, so the play loop's
   * existing `.catch` can show its "computer could not make a move" message
   * rather than hanging forever.
   */
  choosePly(state: PlayState): Promise<Ply> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise<Ply>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.post({ type: "choose", requestId, state });
    });
  }

  /**
   * Tells the worker to adopt its pending working tree, descended into
   * `ply` - the computer's own chosen move having actually been played
   * (fixed decision 8). Fire-and-forget: the caller has already applied the
   * move locally by the time this is worth calling.
   */
  commit(ply: Ply): void {
    this.post({ type: "commit", ply });
  }

  /**
   * Tells the worker to descend its retained tree into the human's `ply`
   * (or discard the tree if `ply` was never explored there). Fire-and-forget.
   */
  observe(ply: Ply): void {
    this.post({ type: "observe", ply });
  }

  /**
   * Tells the worker to drop its retained and pending trees ("New game"),
   * keeping the worker and its warm onnxruntime session alive (fixed
   * decision 9). Fire-and-forget.
   */
  reset(): void {
    this.post({ type: "reset" });
  }

  /**
   * Terminates the worker outright, abandoning any in-flight search and
   * destroying its tree (fixed decision 9) - called when the game is left.
   * Any `choosePly` still awaiting a reply is rejected rather than left
   * hanging.
   */
  terminate(): void {
    this.rejectAllPending("SearchClient: worker terminated.");
    this.worker.terminate();
  }

  private post(message: SearchWorkerRequest): void {
    this.worker.postMessage(message);
  }

  private handleMessage(message: SearchWorkerResponse): void {
    const pending = this.pending.get(message.requestId);
    if (pending === undefined) {
      return;
    }
    this.pending.delete(message.requestId);
    if (message.type === "chosen") {
      pending.resolve(message.ply);
    } else {
      pending.reject(new Error(message.message));
    }
  }

  private rejectAllPending(message: string): void {
    for (const pending of this.pending.values()) {
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }
}
