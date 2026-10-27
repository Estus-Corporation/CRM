import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Building2, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Workspace } from '@/services/auth.service';
import { useEnterWorkspace, useWorkspaces } from '@/hooks/useWorkspaces';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/company/CompanyLogo';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
  captador: 'Captador',
};

const planBadge: Record<string, string> = {
  free: 'FREE',
  starter: 'STARTER',
  pro: 'PRO',
  enterprise: 'ENT',
};

interface WorkspaceSwitcherProps {
  className?: string;
  /** Só o ícone (menu lateral recolhido) */
  compact?: boolean;
  /** "name": só o nome do espaço + seta, sobre o card verde do topo do menu lateral; a lista abre pra baixo */
  variant?: 'pill' | 'name';
}

/**
 * Seletor de workspace no rodapé do menu lateral. A lista abre pra cima, em portal (fixed),
 * pra escapar do overflow do menu.
 */
export function WorkspaceSwitcher({ className, compact, variant = 'pill' }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: workspaces = [] } = useWorkspaces();
  const enter = useEnterWorkspace();
  const switching = enter.isPending;

  const currentTenantId = user?.tenant_id;
  const current = workspaces.find((w) => w.id === currentTenantId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    const close = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', close);
    };
  }, []);

  const toggle = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos(
        variant === 'name'
          ? // Abaixo do topo do menu, alinhada com o logo do espaço (52px à esquerda do nome)
            { top: rect.bottom + 10, left: Math.max(8, rect.left - 50), width: 256 }
          : { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: Math.max(rect.width, 256) },
      );
    }
    setOpen((v) => !v);
  };

  /** Engrenagem: abre o perfil da empresa (troca de workspace antes, se for outro) */
  const openCompanySettings = async (workspace: Workspace) => {
    setOpen(false);
    if (workspace.id !== currentTenantId && !(await handleSwitch(workspace))) return;
    navigate('/settings#empresa');
  };

  const handleSwitch = async (workspace: Workspace): Promise<boolean> => {
    if (workspace.id === currentTenantId) return true;
    if (switching) return false;
    setOpen(false);
    try {
      await enter.mutateAsync(workspace);
      return true;
    } catch {
      return false;
    }
  };

  return (
    // min-w-0: em espaço estreito o nome do workspace trunca em vez de vazar
    <div ref={ref} className={cn('relative min-w-0', className)}>
      {variant === 'name' ? (
        <button
          onClick={toggle}
          disabled={switching}
          title="Trocar de espaço"
          aria-label={`Espaço: ${current?.name ?? ''}`}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 text-left text-white transition-colors hover:bg-white/10',
            switching && 'cursor-wait opacity-50',
          )}
        >
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
            {switching ? 'Trocando…' : (current?.name ?? '—')}
          </span>
          <ChevronDown size={14} className={cn('flex-shrink-0 text-white/80 transition-transform', open && 'rotate-180')} />
        </button>
      ) : (
      <button
        onClick={toggle}
        disabled={switching}
        title={current?.name}
        aria-label={`Workspace: ${current?.name ?? ''}`}
        className={cn(
          // Esmeralda profundo fixo (não o token): branco sobre o verde claro do tema escuro perderia contraste
          'flex h-11 items-center gap-2 rounded-[10px] bg-[#0E8F5A] text-sm text-white',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-[#0B7D4E]',
          compact ? 'w-12 justify-center' : 'w-full px-3.5',
          open && 'bg-[#0B7D4E]',
          switching && 'opacity-50 cursor-wait',
        )}
      >
        {/* Com logo, ele aparece no botão; sem logo, o ícone de prédio */}
        {current?.logo_url ? (
          <img
            src={current.logo_url}
            alt=""
            className={cn('flex-shrink-0 rounded-md object-contain', compact ? 'h-7 w-7' : 'h-6 w-6')}
          />
        ) : (
          <Building2 size={compact ? 17 : 15} className="flex-shrink-0 text-white/90" />
        )}
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-left font-medium">
              {switching ? 'Trocando...' : (current?.name ?? '—')}
            </span>
            {/* Lista abre pra cima: seta aponta pra cima quando fechada */}
            <ChevronDown
              size={14}
              className={cn('flex-shrink-0 text-white/80 transition-transform', !open && 'rotate-180')}
            />
          </>
        )}
      </button>
      )}

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, width: menuPos.width }}
          className="z-[70] overflow-hidden rounded-lg border border-bg-border bg-bg-surface shadow-xl"
        >
          <div className="px-3 py-2 border-b border-bg-border">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Workspaces</p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {workspaces.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-2">Nenhum workspace encontrado</p>
            ) : (
              workspaces.map((ws) => (
                // Linha = troca de workspace; engrenagem (só admin) = configurar a empresa daquele workspace
                <div
                  key={ws.id}
                  className={cn(
                    'flex items-center gap-1 pr-2 transition-colors hover:bg-bg-border/50',
                    ws.id === currentTenantId && 'bg-accent-green/5',
                  )}
                >
                <button
                  onClick={() => handleSwitch(ws)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left"
                  title={ws.id === currentTenantId ? 'Workspace atual' : `Entrar em ${ws.name}`}
                >
                  <CompanyLogo name={ws.name} logoUrl={ws.logo_url} className="h-7 w-7 flex-shrink-0 rounded-md text-xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                    <p className="text-xs text-text-muted">{ROLE_LABEL[ws.role] ?? ws.role}</p>
                  </div>
                  <span className="flex-shrink-0 rounded bg-bg-border px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                    {planBadge[ws.plan] ?? ws.plan.toUpperCase()}
                  </span>
                </button>
                {ws.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => openCompanySettings(ws)}
                    aria-label={`Configurar ${ws.name}`}
                    title="Configurar informações da empresa"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fg/[0.08] hover:text-accent-green"
                  >
                    <Settings size={15} />
                  </button>
                )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-bg-border p-1">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-bg-border/50 rounded transition-colors"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus size={13} />
              Criar novo workspace
            </button>
          </div>
        </div>,
        document.body,
      )}
      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
