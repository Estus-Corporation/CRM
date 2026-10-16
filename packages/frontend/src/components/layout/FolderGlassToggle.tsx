import { motion } from 'framer-motion';
import { Blend } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';

/** Liga/desliga a pasta translúcida (o shader de fundo aparece desfocado através dela). */
export function FolderGlassToggle() {
  const { folderGlass, toggleFolderGlass } = useUIStore();
  const label = folderGlass ? 'Desligar transparência' : 'Ligar transparência';

  return (
    <button
      type="button"
      onClick={toggleFolderGlass}
      title={label}
      aria-label={label}
      aria-pressed={folderGlass}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-200 hover:bg-fg/[0.05] hover:text-text-primary',
        folderGlass ? 'bg-fg/[0.08] text-text-primary' : 'text-text-secondary',
      )}
    >
      <motion.span
        className="flex"
        animate={{ rotate: folderGlass ? 180 : 0, scale: folderGlass ? 1.05 : 1 }}
        transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.25 }}
      >
        <Blend size={19} strokeWidth={1.75} />
      </motion.span>
    </button>
  );
}
