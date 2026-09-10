/**
 * Responsibility: test-runner configuration. Kept separate from vite.config.ts
 * so the production build config stays free of test concerns, and merged with
 * it so plugins and module resolution stay identical between `vite build` and
 * the suite — a test should exercise the same module graph the app ships.
 *
 * Two projects, because the two layers have genuinely different needs:
 *
 * - `domain` runs in Node with no DOM at all. That is not an optimisation, it
 *   is the point: `.claude/RULES.md` requires src/boxing/ to be
 *   framework-agnostic, and running it without a `document` turns an accidental
 *   DOM dependency into a failing test rather than a passing one.
 * - `ui` runs in jsdom with @testing-library/react, for the component tests
 *   that arrive with the component layer.
 */
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'domain',
            environment: 'node',
            include: ['src/{boxing,types,utils,animations}/**/*.test.ts'],
            // Explicit imports (`import { describe } from 'vitest'`) rather
            // than globals, so a test file's dependencies are visible in the
            // file and tsc checks them with no ambient types entry.
            globals: false,
            restoreMocks: true,
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            environment: 'jsdom',
            include: ['src/{components,hooks,pages,test}/**/*.test.{ts,tsx}'],
            setupFiles: ['./src/test/setup.ts'],
            globals: false,
            restoreMocks: true,
          },
        },
      ],
    },
  }),
)
