import { useId } from 'react';
import { motion } from 'framer-motion';

/**
 * Mini linha de tendência (sem eixos): curva suave + véu embaixo, desenhada ao aparecer.
 * Só forma — o valor exato está no próprio KPI ao lado.
 */
export function Sparkline({ data, width = 96, height = 34 }: { data: number[]; width?: number; height?: number }) {
  const id = useId().replace(/:/g, '');
  if (data.length < 2) return null;

  const pad = 3;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (width - pad * 2),
    // Série toda igual: linha no meio, não colada no chão
    max === min ? height / 2 : height - pad - ((v - min) / range) * (height - pad * 2),
  ]);

  // Curva suave (Catmull-Rom → Bézier)
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] ?? pts[i];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2] ?? pts[i + 1];
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6];
    const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x2} ${y2}`;
  }
  const last = pts[pts.length - 1];
  const area = `${d} L ${last[0]} ${height} L ${pts[0][0]} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible text-accent-green" aria-hidden>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.14} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#spark-${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeOpacity={0.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      />
    </svg>
  );
}
