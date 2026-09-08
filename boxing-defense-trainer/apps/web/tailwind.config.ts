/**
 * Responsibility: the single source of truth for the visual design tokens of
 * Boxing Defense Trainer (colours, type, radii, elevation).
 *
 * Per .claude/RULES.md there are no ad-hoc colour values in components: every
 * surface, text and accent colour must resolve to a token defined here, so the
 * whole app can be re-themed from one file.
 *
 * Palette intent: a dark, professional sports-training look. A near-black
 * neutral ramp (`ink`) carries the entire UI, and exactly one accent (`ember`,
 * a desaturated crimson) marks the things that demand the athlete's attention —
 * incoming attacks, active timers, primary actions. No bright or playful hues.
 */
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /** Neutral ramp. `ink-950` is the app background; higher surfaces step up. */
        ink: {
          50: '#F5F6F7',
          100: '#E6E8EB',
          200: '#C8CCD2',
          300: '#9BA1A8',
          400: '#6E757D',
          500: '#4C525A',
          600: '#363B42',
          700: '#24282E',
          800: '#171A1E',
          900: '#0E1013',
          950: '#08090A',
        },
        /** The one accent. Use sparingly — if everything is accented, nothing is. */
        ember: {
          50: '#FBEDEB',
          100: '#F5D6D1',
          200: '#E9AFA6',
          300: '#DC8779',
          400: '#CF6153',
          500: '#C2372C',
          600: '#A32C23',
          700: '#82231C',
          800: '#611A15',
          900: '#40110E',
          950: '#260A08',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        /** Tabular readout face for timers, counters and scores. */
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        panel: '0.75rem',
      },
      boxShadow: {
        /** Elevation for HUD panels over the webcam feed. */
        panel: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px rgb(0 0 0 / 0.55)',
        /** Restrained accent glow for active/incoming states. */
        ember: '0 0 0 1px rgb(194 55 44 / 0.35), 0 0 24px rgb(194 55 44 / 0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config
