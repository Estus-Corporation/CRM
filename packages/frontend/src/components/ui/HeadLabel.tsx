import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Rótulo de coluna com ícone (cabeçalho verde das listas e tabelas) */
export function HeadLabel({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon size={13} strokeWidth={2.2} className="flex-shrink-0" />
      {children}
    </span>
  );
}
