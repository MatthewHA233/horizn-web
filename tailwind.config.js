/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#030712',   // body — near-black, barely cool
          1: '#0c0e15',   // base card
          2: '#13161f',   // elevated surface
          3: '#1a1e2a',   // hover / active
          4: '#21263a',   // selected
        },
        ink: {
          primary:   '#e2e4ed',
          secondary: '#8b8fa8',
          muted:     '#4a4e63',
          ghost:     '#2d3047',
        },
        line: {
          subtle:  'rgba(255,255,255,0.05)',
          default: 'rgba(255,255,255,0.09)',
          strong:  'rgba(255,255,255,0.16)',
        },
        amber: {
          dim:    'rgba(251,191,36,0.08)',
          soft:   'rgba(251,191,36,0.18)',
          base:   '#fbbf24',
          bright: '#fde68a',
        },
        purple: {
          dim:  'rgba(167,139,250,0.08)',
          soft: 'rgba(167,139,250,0.18)',
          base: '#a78bfa',
        },
        blue: {
          dim:  'rgba(99,179,237,0.08)',
          soft: 'rgba(99,179,237,0.18)',
          base: '#63b3ed',
        },
      },
      boxShadow: {
        'panel':      '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.7)',
        'popup':      '0 0 0 1px rgba(255,255,255,0.07), 0 16px 48px rgba(0,0,0,0.8)',
        'amber-glow': '0 0 16px rgba(251,191,36,0.12)',
        'row-hover':  '0 1px 0 rgba(255,255,255,0.04) inset',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tight:  '-0.03em',
        snug:   '-0.015em',
        normal: '0em',
        open:   '0.04em',
        wide:   '0.08em',
      },
    },
  },
  plugins: [],
}
