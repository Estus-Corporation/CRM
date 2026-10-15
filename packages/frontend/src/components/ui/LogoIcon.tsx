import { useId } from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
  /** 'aurora' pinta a estrela com o gradiente verde → azul → violeta */
  variant?: 'white' | 'aurora';
}

export function LogoIcon({ size = 24, className, variant = 'white' }: LogoIconProps) {
  const gradientId = useId();
  const fill = variant === 'aurora' ? `url(#${gradientId})` : 'white';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {variant === 'aurora' && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#72d296" />
            <stop offset="45%" stopColor="#4cc9c0" />
            <stop offset="75%" stopColor="#6b8cff" />
            <stop offset="100%" stopColor="#a27bff" />
          </linearGradient>
        </defs>
      )}
      {/* Cardinal points — N, E, S, W (long, narrow blades) */}
      <polygon
        points="50,3 52.5,47.5 97,50 52.5,52.5 50,97 47.5,52.5 3,50 47.5,47.5"
        fill={fill}
      />
      {/* Diagonal points — NE, SE, SW, NW (shorter blades at 45°) */}
      <polygon
        points="71,29 53.5,50 71,71 50,53.5 29,71 47,50 29,29 50,46.5"
        fill={fill}
      />
    </svg>
  );
}
