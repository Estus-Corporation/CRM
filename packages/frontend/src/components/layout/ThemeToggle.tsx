import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, useTheme, useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';

export function ThemeToggle() {
  const theme = useTheme();
  const setTheme = useThemeStore((s) => s.setTheme);
  const userId = useAuthStore((s) => s.user?.id);
  const isDark = theme === 'dark';

  const handleClick = () => {
    const next = isDark ? 'light' : 'dark';
    applyTheme(next, true);
    if (userId) setTheme(userId, next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.05] hover:text-text-primary"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5, y: 6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5, y: -6 }}
          transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.15 }}
          className="flex"
        >
          {isDark ? <Moon size={19} strokeWidth={1.75} /> : <Sun size={20} strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
