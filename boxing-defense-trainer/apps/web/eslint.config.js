/**
 * Responsibility: encode the non-negotiable rules from `.claude/RULES.md` as
 * lint errors, so the architecture is enforced by tooling rather than by
 * reviewer memory.
 *
 * The two rules that matter most here:
 *   1. `any` is an error. It is still available as a deliberate, documented
 *      escape hatch via `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`,
 *      and `@eslint-community/eslint-comments/require-description` makes that `-- <reason>`
 *      mandatory, so no `any` can enter the codebase unjustified.
 *   2. `src/boxing/**` may not import React in any form. The boxing domain is
 *      framework-agnostic and must stay testable without a renderer.
 */
import js from '@eslint/js'
import comments from '@eslint-community/eslint-plugin-eslint-comments'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },

  // Application + config sources.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@eslint-community/eslint-comments': comments },
    rules: {
      ...comments.configs.recommended.rules,

      // No `any` without a justification. The disable comment must carry a
      // `-- reason` description, enforced by require-description below.
      '@typescript-eslint/no-explicit-any': 'error',
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unused-disable': 'error',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // The boxing domain is framework-agnostic: zero React, zero DOM-framework
  // coupling. See .claude/RULES.md.
  {
    files: ['src/boxing/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'src/boxing/** must stay framework-agnostic — no React imports. Move UI concerns to src/components or src/hooks.',
            },
            {
              name: 'react-dom',
              message: 'src/boxing/** must stay framework-agnostic — no react-dom imports.',
            },
            {
              name: 'framer-motion',
              message:
                'src/boxing/** must stay framework-agnostic — animation belongs in src/animations.',
            },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*', 'motion', 'motion/*'],
              message: 'src/boxing/** must stay framework-agnostic.',
            },
            {
              group: ['**/components/**', '**/hooks/**', '**/pages/**', '**/animations/**'],
              message:
                'src/boxing/** is the domain layer: the UI imports from it, never the other way round. Nothing in components/, hooks/, pages/ or animations/ may be imported here.',
            },
          ],
        },
      ],
    },
  },

  // Node-side config files.
  {
    files: ['vite.config.ts', 'tailwind.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },

  // Prettier owns formatting; turn off every stylistic rule that would fight it.
  prettier,
)
