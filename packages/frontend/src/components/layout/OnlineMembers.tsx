import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnlineMembers } from '@/hooks/usePresence';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { dropdownMotion } from '@/lib/motion';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', captador: 'Captador' };

/**
 * Quem do espaço está online agora: fotos empilhadas no topo (sem contar você) e, ao clicar, a lista.
 * Some quando só você está online.
 */
export function OnlineMembers() {
  const { data = [] } = useOnlineMembers();
  const userId = useAuthStore((s) => s.user?.id);
  const others = data.filter((m) => m.id !== userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (others.length === 0) return null;
  const shown = others.slice(0, 3);

  return (
    <div ref={ref} className="relative max-md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={`${others.length} ${others.length === 1 ? 'pessoa online' : 'pessoas online'}`}
        className="flex h-10 items-center gap-2 rounded-[10px] px-2 transition-colors hover:bg-fg/[0.06]"
      >
        <span className="flex -space-x-2">
          {shown.map((m) => (
            <Avatar key={m.id} name={m.full_name} src={m.avatar_url} className="h-7 w-7 text-[10px] ring-2 ring-bg-primary" />
          ))}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <span className="h-2 w-2 rounded-full bg-accent-green" />
          {others.length} online
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...dropdownMotion}
            style={{ transformOrigin: 'top right' }}
            className="glass-panel absolute right-0 top-full z-50 mt-2 w-64 rounded-xl p-1.5 shadow-2xl"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Online agora</p>
            <ul className="max-h-72 overflow-y-auto">
              {others.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                  <Avatar name={m.full_name} src={m.avatar_url} online className="h-8 w-8 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">{m.full_name}</span>
                    <span className="block text-xs text-text-muted">{ROLE_LABEL[m.role] ?? m.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
