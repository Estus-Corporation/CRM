import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Building2, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type Workspace } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const planBadge: Record<string, string> = {
  free: 'FREE',
  starter: 'STARTER',
  pro: 'PRO',
  enterprise: 'ENT',
};

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { user, setAuth, setTokens } = useAuthStore();

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: authService.listWorkspaces,
    staleTime: 30 * 1000,
  });

  const currentTenantId = user?.tenant_id;
  const current = workspaces.find((w) => w.id === currentTenantId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (workspace: Workspace) => {
    if (workspace.id === currentTenantId || switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      const result = await authService.switchWorkspace(workspace.id);
      // Update tokens + user tenant_id in store
      if (user) {
        setAuth({ ...user, tenant_id: workspace.id, role: workspace.role as typeof user.role }, result.accessToken, result.refreshToken);
      } else {
        setTokens(result.accessToken, result.refreshToken);
      }
      // Clear all cached queries so new tenant data loads fresh
      qc.clear();
      toast.success(`Workspace alterado para "${workspace.name}"`);
    } catch {
      toast.error('Não foi possível trocar de workspace');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className={cn(
          // Esmeralda profundo fixo (não o token): branco sobre o verde claro do tema escuro perderia contraste
          'flex h-10 items-center gap-2 rounded-[10px] bg-[#0E8F5A] px-3.5 text-sm text-white',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-[#0B7D4E]',
          open && 'bg-[#0B7D4E]',
          switching && 'opacity-50 cursor-wait',
        )}
      >
        <Building2 size={15} className="flex-shrink-0 text-white/90" />
        <span className="max-w-[140px] truncate font-medium">
          {switching ? 'Trocando...' : (current?.name ?? '—')}
        </span>
        <ChevronDown
          size={14}
          className={cn('flex-shrink-0 text-white/80 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-bg-surface border border-bg-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-bg-border">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Workspaces</p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {workspaces.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-2">Nenhum workspace encontrado</p>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-border/50 transition-colors',
                    ws.id === currentTenantId && 'bg-accent-green/5',
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-accent-green/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-accent-green uppercase">
                      {ws.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                    <p className="text-xs text-text-muted capitalize">{ws.role}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-semibold text-text-muted bg-bg-border px-1.5 py-0.5 rounded">
                      {planBadge[ws.plan] ?? ws.plan.toUpperCase()}
                    </span>
                    {ws.id === currentTenantId && (
                      <Check size={13} className="text-accent-green" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-bg-border p-1">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-bg-border/50 rounded transition-colors"
              onClick={() => {
                setOpen(false);
                toast.info('Para entrar em outro workspace, peça um convite ao administrador.');
              }}
            >
              <Plus size={13} />
              Entrar em outro workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
