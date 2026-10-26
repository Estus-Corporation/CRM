import { useEffect, useState } from 'react';

/** true enquanto a media query casa (ex.: '(max-width: 767px)'); acompanha resize/rotação */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Celular = abaixo do breakpoint md do Tailwind */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
