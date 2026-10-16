import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { centerTransform, dialogMotion, overlayMotion } from '@/lib/motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      {/* forceMount + AnimatePresence: o Radix mantém o modal montado até a animação de saída terminar */}
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40 bg-black/55" {...overlayMotion} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                {...dialogMotion}
                transformTemplate={centerTransform}
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg',
                  'rounded-2xl border border-fg/[0.08] bg-bg-surface p-6 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.55)] focus:outline-none',
                  className,
                )}
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-[17px] font-semibold text-text-primary">{title}</Dialog.Title>
                    {description && (
                      <Dialog.Description className="mt-1 text-sm text-text-secondary">{description}</Dialog.Description>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
                  >
                    <X size={17} />
                  </button>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
