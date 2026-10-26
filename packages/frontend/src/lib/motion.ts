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

/** Menus e painéis que descem de um botão (perfil, caixa de entrada): caem do botão com um quique leve */
export const dropdownMotion = {
  initial: { opacity: 0, scale: 0.92, y: -8, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', visualDuration: 0.24, bounce: 0.28, opacity: { duration: 0.12 }, filter: { duration: 0.16 } },
    // filter (mesmo blur(0)) quebra backdrop-filter e position:fixed dos filhos — some ao terminar
    transitionEnd: { filter: 'none' },
  },
  exit: { opacity: 0, scale: 0.96, y: -4, filter: 'blur(2px)', transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } },
} as const;

/** Troca de tela: a nova sobe de leve e desfoca pra nítido; a anterior some rápido */
export const pageMotion = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', visualDuration: 0.38, bounce: 0.18, opacity: { duration: 0.2 }, filter: { duration: 0.24 } },
    transitionEnd: { filter: 'none', transform: 'none' },
  },
  exit: { opacity: 0, y: -6, filter: 'blur(3px)', transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } },
} as const;

/**
 * Pra diálogos posicionados com left/top 50%: mantém o translate(-50%, -50%) de centralização
 * e soma por cima o transform que o framer gera (scale da animação).
 */
export const centerTransform = (_: unknown, generated: string) =>
  `translate(-50%, -50%) ${generated === 'none' ? '' : generated}`;
