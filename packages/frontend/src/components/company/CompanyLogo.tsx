import { cn } from '@/lib/utils';

interface Props {
  name?: string | null;
  logoUrl?: string | null;
  className?: string;
}

/** Logo do workspace; sem logo, a inicial do nome num quadrado esmeralda */
export function CompanyLogo({ name, logoUrl, className }: Props) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name ?? 'Logo da empresa'} className={cn('rounded-[10px] object-contain', className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-[10px] bg-accent-green/15 font-bold uppercase text-accent-green',
        className,
      )}
    >
      {name?.trim().charAt(0) || '?'}
    </span>
  );
}
