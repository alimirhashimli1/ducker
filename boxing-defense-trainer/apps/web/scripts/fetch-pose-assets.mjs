/**
 * Vendors the pose assets into public/, so the app can run with no third-party
 * origin at all — offline, or behind a policy that forbids external requests.
 *
 * Not run by default: it adds roughly 40 MB to dist/ and to the container image.
 * After running it, point POSE_WASM_BASE and POSE_MODEL_URL in
 * src/hooks/poseAssets.ts at the LOCAL_* values.
 *
 *     npm run pose:assets
 *
 * The WASM is copied out of node_modules rather than downloaded, so it always
 * matches the installed @mediapipe/tasks-vision version.
 */
import { cp, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSource = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmTarget = resolve(root, 'public/mediapipe/wasm')
const modelTarget = resolve(root, 'public/mediapipe/models/pose_landmarker_lite.task')

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const exists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(wasmSource))) {
  console.error('@mediapipe/tasks-vision is not installed. Run npm install first.')
  process.exit(1)
}

await cp(wasmSource, wasmTarget, { recursive: true })
console.log(`WASM runtime copied to ${wasmTarget}`)

if (await exists(modelTarget)) {
  console.log('Model already present; leaving it alone.')
} else {
  console.log(`Downloading the pose model…`)
  const response = await fetch(MODEL_URL)

  if (!response.ok) {
    console.error(`Model download failed: ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  await mkdir(dirname(modelTarget), { recursive: true })
  await writeFile(modelTarget, Buffer.from(await response.arrayBuffer()))
  console.log(`Model saved to ${modelTarget}`)
}

console.log('\nNow set POSE_WASM_BASE and POSE_MODEL_URL in src/hooks/poseAssets.ts')
console.log('to LOCAL_WASM_BASE and LOCAL_MODEL_URL.')
