// In-browser ONNX inference for the bundled ENG_NN_1 reference model (story
// 00000019, Step 3). Loads the `InferenceSession` once, lazily, from the
// model served at `MODEL_URL`, and exposes an async `evaluatePosition` that
// encodes a position with encoding v1's `encodePosition` and runs it through
// the network.
//
// The ENG_NN_1 spec (companion repo, `doc/neuralnetwork/eng-nn-1.md`) does
// not name the model's input/output tensors, so this module never hardcodes
// them: the input is fed via the session's own `inputNames[0]`, and the two
// outputs are told apart by their element count - the value head has 1
// element, the policy head has 8*12*12 = 1152 - not by name.
//
// This module is the inference boundary only: it runs the network and
// returns raw value/policy tensors. It knows nothing about legal plies -
// Step 2's decoder (`src/encoding/eng-nn-1/decoder.ts`) masks and samples the
// policy against the rules engine's legal set. Kept async (a `Promise`) so a
// Web Worker can be dropped in later without reshaping the boundary (see
// story.md's "Async from day one").

import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import { encodePosition, type Position } from "../encoding/eng-nn-1/encoder.ts";

/** Where Vite serves the bundled reference model (`public/models/`). */
const MODEL_URL = "/models/ctf_reference.onnx";

/** The policy head's flat length: 8 movement indices * 12 rows * 12 cols. */
const POLICY_LENGTH = 8 * 12 * 12;

/** The value head is always a single scalar. */
const VALUE_LENGTH = 1;

// Import onnxruntime-web's WASM runtime files as Vite assets (`?url`) rather
// than self-hosting a copy under public/: onnxruntime-web dynamically
// `import()`s the .mjs loader, which Vite forbids for files served out of
// public/ (and the dev server sends it with no MIME type), so it must be an
// asset Vite itself resolves, hashes, and serves/copies into dist/.
ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
// Single-threaded: a static file host can't be assumed to send the
// COOP/COEP headers cross-origin isolation (and therefore SharedArrayBuffer,
// which multi-threaded WASM needs) requires. See story.md's "Static-host
// friendly".
ort.env.wasm.numThreads = 1;

/** The network's raw output for one position: the value scalar and the length-1152 policy logits. */
export interface EngineEvaluation {
  /** The value head's scalar, in `[-1, 1]`, from the position's side-to-move's perspective. */
  readonly value: number;
  /** The policy head's raw logits, flat length 1152, in `(movementIndex, row, col)` order. */
  readonly policy: Float32Array;
}

let sessionPromise: Promise<ort.InferenceSession> | undefined;

/** Loads (once, cached) and returns the reference model's inference session. */
function loadSession(): Promise<ort.InferenceSession> {
  sessionPromise ??= ort.InferenceSession.create(MODEL_URL);
  return sessionPromise;
}

/**
 * Encodes `position` (Step 1's `encodePosition`) and runs it through the
 * bundled reference model, returning the value scalar and the length-1152
 * policy logits. Throws if the loaded model's outputs don't match ENG_NN_1's
 * expected shapes.
 */
export async function evaluatePosition(
  position: Position,
): Promise<EngineEvaluation> {
  const session = await loadSession();

  const inputName = session.inputNames[0];
  if (inputName === undefined) {
    throw new Error(
      "ctf_reference.onnx declares no input; can't feed it a position.",
    );
  }

  const { data, dims } = encodePosition(position);
  const results = await session.run({
    [inputName]: new ort.Tensor("float32", data, dims),
  });

  let value: number | undefined;
  let policy: Float32Array | undefined;
  for (const name of session.outputNames) {
    const tensor = results[name];
    if (tensor === undefined) {
      continue;
    }
    if (tensor.size === VALUE_LENGTH) {
      value = Number(tensor.data[0]);
    } else if (tensor.size === POLICY_LENGTH) {
      policy = Float32Array.from(tensor.data as ArrayLike<number>);
    }
  }

  if (value === undefined || policy === undefined) {
    const observed = session.outputNames
      .map((name) => `${name}=${results[name]?.size}`)
      .join(", ");
    throw new Error(
      `ctf_reference.onnx's outputs don't match ENG_NN_1's expected shapes ` +
        `(value: ${VALUE_LENGTH} element, policy: ${POLICY_LENGTH} elements); observed [${observed}].`,
    );
  }

  return { value, policy };
}
