import type { Config } from 'tailwindcss';
import { BRAND, HEAT_COLOR } from './src/tokens/tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ...BRAND,
        heat: HEAT_COLOR,
      },
      fontFamily: {
        display: ['Newsreader', 'serif'],
        body: ['Hanken Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      transitionDuration: { fast: '150ms', normal: '250ms' },
      transitionTimingFunction: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      maxWidth: { content: '1400px' },
      fontSize: {
        'display-xl': ['48px', { lineHeight: '1.05' }],
        display: ['34px', { lineHeight: '1.1' }],
        h2: ['24px', { lineHeight: '1.2' }],
        'body-lg': ['16px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.5' }],
        caption: ['12px', { lineHeight: '1.4' }],
        'mono-label': ['11px', { lineHeight: '1', letterSpacing: '0.16em' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
