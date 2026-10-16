import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta "Ink · Esmeralda · Âmbar" — 3 cores. Valores vêm de variáveis CSS (globals.css)
        // que trocam entre tema escuro e claro; `<alpha-value>` mantém os modificadores /10, /20...
        bg: {
          primary: v('--bg-primary'),
          darker: v('--bg-darker'),
          surface: v('--bg-surface'),
          border: v('--bg-border'),
        },
        accent: {
          green: v('--accent-green'),
          'green-dim': v('--accent-green-dim'),
          amber: v('--accent-amber'),
        },
        // Tinta de sobreposição: branco no escuro, tinta escura no claro — usar em vez de `white/[x]`
        fg: v('--fg'),
        // Fundo de campos: branco no claro, um degrau acima do fundo no escuro
        field: v('--field-bg'),
        'text-primary': v('--text-primary'),
        'text-secondary': v('--text-secondary'),
        'text-muted': v('--text-muted'),
        status: {
          won: v('--accent-green'),
          lost: v('--status-lost'),
          open: v('--accent-amber'),
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
