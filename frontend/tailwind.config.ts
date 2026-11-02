import path from 'node:path';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [path.join(__dirname, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-elevated-2': 'var(--bg-elevated-2)',
        gold: {
          400: 'var(--gold-400)',
          500: 'var(--gold-500)',
          700: 'var(--gold-700)',
        },
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        subtle: 'var(--subtle)',
        faint: 'var(--faint)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        error: 'var(--error)',
        success: 'var(--success)',
      },
      fontFamily: {
        serif: ['var(--font-display)', 'Arial Narrow', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      borderRadius: {
        sm: '10px',
        md: '12px',
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.06), 0 8px 24px -12px rgba(0,0,0,.25)',
        lift: '0 2px 6px rgba(0,0,0,.08), 0 24px 48px -24px rgba(0,0,0,.45)',
      },
      maxWidth: {
        screen: '1440px',
      },
    },
  },
  plugins: [],
};

export default config;
