interface LogoIconProps {
  size?: number;
  className?: string;
  /** 'brand' pinta com `currentColor` — controle a cor via className (ex.: text-accent-green) */
  variant?: 'white' | 'brand';
}

export function LogoIcon({ size = 24, className, variant = 'white' }: LogoIconProps) {
  const fill = variant === 'brand' ? 'currentColor' : 'white';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
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
