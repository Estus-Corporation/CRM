import { useTheme } from '@/store/themeStore';

// Recharts passa cores como atributos SVG, que não resolvem var(--x) — por isso os valores
// ficam aqui, espelhando as variáveis de globals.css.
const PALETTE = {
  dark: {
    // Verde das marcas de gráfico no escuro: um passo abaixo do da marca (#4FD69C fica fora da faixa
    // de luminosidade recomendada pra marcas em fundo escuro — validado com o validate_palette da skill dataviz)
    brand: '#2FA676',
    brandDim: '#38B27E',
    amber: '#F5B547',
    axis: '#A0A6B3',
    axisMuted: '#6C7280',
    grid: 'rgba(255,255,255,0.06)',
    cursor: 'rgba(255,255,255,0.04)',
    tooltipBg: 'rgba(20,23,30,0.95)',
    tooltipBorder: 'rgba(255,255,255,0.08)',
    tooltipText: '#EDEFF3',
    // Superfície do card: anel em volta dos marcadores
    surface: '#161920',
  },
  light: {
    brand: '#0F9D63',
    brandDim: '#6CC79F',
    amber: '#C4800C',
    axis: '#525864',
    axisMuted: '#868B96',
    grid: 'rgba(20,22,28,0.07)',
    cursor: 'rgba(20,22,28,0.04)',
    tooltipBg: 'rgba(255,255,255,0.97)',
    tooltipBorder: 'rgba(20,22,28,0.08)',
    tooltipText: '#15171C',
    surface: '#FFFFFF',
  },
} as const;

export function useChartColors() {
  const theme = useTheme();
  return PALETTE[theme];
}
