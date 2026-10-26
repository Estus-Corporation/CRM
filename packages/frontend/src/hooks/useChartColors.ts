import { useTheme } from '@/store/themeStore';

// Recharts passa cores como atributos SVG, que não resolvem var(--x) — por isso os valores
// ficam aqui, espelhando as variáveis de globals.css.
const PALETTE = {
  dark: {
    brand: '#4FD69C',
    brandDim: '#38B27E',
    amber: '#F5B547',
    axis: '#A0A6B3',
    axisMuted: '#6C7280',
    grid: 'rgba(255,255,255,0.05)',
    cursor: 'rgba(255,255,255,0.04)',
    tooltipBg: 'rgba(20,23,30,0.95)',
    tooltipBorder: 'rgba(255,255,255,0.08)',
    tooltipText: '#EDEFF3',
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
  },
} as const;

export function useChartColors() {
  const theme = useTheme();
  return PALETTE[theme];
}
