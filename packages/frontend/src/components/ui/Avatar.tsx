import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  /** Foto (URL ou data URL); sem foto, as iniciais */
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-6 w-6 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' };

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  // Foto que não carrega (link quebrado, arquivo corrompido) cai para as iniciais
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailedSrc(src)}
        className={cn('flex-shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-accent-green/20 text-accent-green font-medium flex items-center justify-center flex-shrink-0',
        sizes[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
