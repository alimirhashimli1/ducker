/**
 * Responsibility: where the pose model and its WebAssembly runtime are loaded
 * from. Two strings, isolated so the choice can be changed without touching the
 * detection hook.
 *
 * ## What "fully client-side" means here
 *
 * Inference runs entirely in the browser: after these two assets load, no frame,
 * no landmark and no image ever leaves the device, and the detector makes no
 * further network calls. What the URLs below control is only where the assets
 * are fetched from on first load; the browser caches them thereafter.
 *
 * The defaults use Google's CDN, which is how MediaPipe ships out of the box and
 * costs the repository and the container image nothing.
 *
 * ## Self-hosting them instead
 *
 * For an install that must work with no third-party origin at all — offline, or
 * behind a policy that forbids external requests — run:
 *
 *     npm run pose:assets
 *
 * which copies the WASM out of node_modules and downloads the model into
 * `public/mediapipe/`, then switch the two constants below to the LOCAL_*
 * values. See `src/hooks/README.md`.
 *
 * The cost is roughly 40 MB added to `dist/` and to the container image, which
 * is why it is not the default.
 */

/** MediaPipe's CDN, pinned to the version in package.json. */
const CDN_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

const CDN_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

/** Served from this app's own origin, after `npm run pose:assets`. */
export const LOCAL_WASM_BASE = '/mediapipe/wasm'
export const LOCAL_MODEL_URL = '/mediapipe/models/pose_landmarker_lite.task'

/** Directory the WASM runtime is resolved from. */
export const POSE_WASM_BASE = CDN_WASM_BASE

/**
 * The pose model.
 *
 * `lite` rather than `full` or `heavy`: this runs every animation frame against
 * a webcam on whatever laptop the user has, and a model that cannot keep up with
 * the frame rate makes the trainer feel broken in a way that better landmark
 * accuracy would not make up for.
 */
export const POSE_MODEL_URL = CDN_MODEL_URL
