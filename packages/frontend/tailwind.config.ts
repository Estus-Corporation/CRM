import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Aurora Slate" — ardósia azulada escura; o verde da marca segue como acento principal
        bg: {
          primary: '#0a0d15',
          darker: '#07090f',
          surface: '#131926',
          border: '#1f2636',
        },
        accent: {
          green: '#72d296',
          'green-dim': '#4a9b6f',
        },
        // Tons da aurora — usar como luz (gradientes, hairlines, brilhos), não como preenchimento
        aurora: {
          green: '#72d296',
          teal: '#4cc9c0',
          blue: '#6b8cff',
          violet: '#a27bff',
        },
        'text-primary': '#eef1f7',
        'text-secondary': '#9aa4b8',
        'text-muted': '#677086',
        status: {
          won: '#72d296',
          lost: '#ef4444',
          open: '#6b8cff',
        },
      },
      fontFamily: {
        // Geist: neutra e precisa — tira o ar "template" do Inter padrão
        sans: [
          'Geist',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        // Marketing surfaces (landing). Sora carries display, Geist carries body.
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
