import type { Transition } from 'framer-motion';

/**
 * Padrão de animação de todos os modais do app.
 * Entrada: "pop" — surge levemente menor e salta pro tamanho normal, rápido, com um quique curto.
 * Saída: encolhe e some quase instantânea. O fundo escurece junto.
 */

const enterSpring: Transition = { type: 'spring', visualDuration: 0.2, bounce: 0.32 };
const exitTween: Transition = { duration: 0.11, ease: [0.4, 0, 1, 1] };

export const overlayMotion = {
  initial: { opacity: 0, backdropFilter: 'blur(0px)' },
  animate: { opacity: 1, backdropFilter: 'blur(6px)', transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.12, ease: 'easeIn' } },
} as const;

export const dialogMotion = {
  initial: { opacity: 0, scale: 0.9 },
  // opacity num tween curtinho separado: aparece de imediato enquanto o scale faz o pop
  animate: { opacity: 1, scale: 1, transition: { ...enterSpring, opacity: { duration: 0.08 } } },
  exit: { opacity: 0, scale: 0.94, transition: exitTween },
} as const;

/**
 * Pra diálogos posicionados com left/top 50%: mantém o translate(-50%, -50%) de centralização
 * e soma por cima o transform que o framer gera (scale da animação).
 */
export const centerTransform = (_: unknown, generated: string) =>
  `translate(-50%, -50%) ${generated === 'none' ? '' : generated}`;
