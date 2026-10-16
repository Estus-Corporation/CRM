import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-bg-border text-text-secondary',
        green: 'bg-accent-green/20 text-accent-green',
        red: 'bg-status-lost/20 text-status-lost',
        blue: 'bg-status-open/20 text-status-open',
        admin: 'bg-accent-green/20 text-accent-green',
        manager: 'bg-accent-amber/20 text-accent-amber',
        seller: 'bg-bg-border text-text-secondary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
