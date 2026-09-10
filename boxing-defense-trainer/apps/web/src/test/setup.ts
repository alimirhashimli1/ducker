/**
 * Responsibility: global test setup, applied to every test file before it runs.
 *
 * Only cross-cutting concerns belong here. A fixture used by one suite belongs
 * in that suite, not in a file every other test also pays for.
 */
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Testing Library registers this itself only when Vitest globals are enabled.
// This project uses explicit imports (`globals: false`), so without this every
// render leaks into the next test and queries match two copies of the DOM.
afterEach(cleanup)
