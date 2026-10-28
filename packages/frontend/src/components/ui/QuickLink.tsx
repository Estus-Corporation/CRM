import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Botão-ícone de atalho (WhatsApp, Instagram, Google, site…): abre direto no perfil/página */
export function QuickLink({
  href,
  label,
  className,
  onClick,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-fg/[0.08] bg-fg/[0.04] transition-transform duration-150 hover:-translate-y-0.5 hover:bg-fg/[0.08] max-sm:h-11 max-sm:w-12',
        className,
      )}
    >
      {children}
    </a>
  );
}
