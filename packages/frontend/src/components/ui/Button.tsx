import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { forwardRef } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Ação principal: único elemento com brilho — discreto, só pra puxar o olho
        primary:
          'bg-accent-green text-[rgb(var(--on-accent))] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_0_1px_rgb(var(--accent-green)/0.5),0_8px_24px_-10px_rgb(var(--accent-green)/0.55)] hover:brightness-110 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_rgb(var(--accent-green)/0.6),0_10px_28px_-10px_rgb(var(--accent-green)/0.7)]',
        secondary:
          'border border-fg/[0.08] bg-fg/[0.04] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md hover:border-fg/[0.14] hover:bg-fg/[0.07]',
        ghost: 'text-text-secondary hover:bg-fg/[0.05] hover:text-text-primary',
        danger: 'bg-status-lost text-white hover:bg-red-600',
        warning: 'bg-orange-500 text-white hover:bg-orange-600',
        outline:
          'border border-fg/[0.08] bg-fg/[0.04] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md hover:border-fg/[0.14] hover:bg-fg/[0.07]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';
