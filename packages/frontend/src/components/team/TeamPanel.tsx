import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, MoreHorizontal, Pencil, Power, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useDeleteUser, useUpdateUser, useUsers } from '@/hooks/useUsers';
import { useCancelInvite, useTenantInvites } from '@/hooks/useInvites';
import { useTenant, useUpdateTenant, type KeyPerson } from '@/hooks/useTenant';
import { useAuthStore, type UserRole } from '@/store/authStore';
import type { TeamMember } from '@/services/users.service';
import { MemberCard, ROLE_LABEL, TitleGroup, groupByTitle, rankOf, titleFor } from '@/components/company/TeamRoster';
import { AddMemberModal } from './AddMemberModal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const TITLE_SUGGESTIONS = ['Fundador', 'Fundadora', 'Cofundador', 'Cofundadora', 'Sócio', 'CEO', 'Diretor', 'Gerente'];

function lastAccess(date: string | null) {
  if (!date) return 'Nunca acessou';
  return `Último acesso ${new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

/** Menu "..." do cartão: cargo, papel, ativar/desativar, remover */
function MemberMenu({ member, isSelf, onEditTitle }: { member: TeamMember; isSelf: boolean; onEditTitle: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const setRole = (role: UserRole) =>
    updateUser.mutate(
      { id: member.id, input: { role } },
      {
        onSuccess: () => toast.success('Papel atualizado'),
        onError: () => toast.error('Erro ao atualizar papel'),
      },
    );

  const toggleActive = () =>
    updateUser.mutate(
      { id: member.id, input: { isActive: !member.is_active } },
      {
        onSuccess: () => toast.success(member.is_active ? 'Membro desativado' : 'Membro reativado'),
        onError: () => toast.error('Erro ao atualizar membro'),
      },
    );

  const item = 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirmDelete(false);
        }}
        aria-label="Ações"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fg/[0.08] hover:text-text-primary"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="glass-panel absolute right-0 top-full z-30 mt-1 w-56 rounded-xl p-1 shadow-xl">
          {confirmDelete ? (
            <div className="p-2">
              <p className="mb-2 text-xs text-text-muted">Tirar do workspace? A conta da pessoa continua existindo.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleteUser.isPending}
                  onClick={() =>
                    deleteUser.mutate(member.id, {
                      onSuccess: () => setOpen(false),
                    })
                  }
                  className="flex-1 rounded-lg bg-status-lost py-1.5 text-xs font-medium text-white"
                >
                  Remover
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg bg-fg/[0.08] py-1.5 text-xs text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEditTitle();
                }}
                className={`${item} text-text-primary hover:bg-fg/[0.06]`}
              >
                <Pencil size={14} />
                Editar cargo
              </button>
              {!isSelf && (
                <>
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-text-secondary">
                    <span className="flex-shrink-0">Papel</span>
                    <select
                      value={member.role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="input-base h-8 flex-1 py-0 text-xs"
                    >
                      {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={toggleActive} className={`${item} text-text-primary hover:bg-fg/[0.06]`}>
                    <Power size={14} />
                    {member.is_active ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className={`${item} text-status-lost hover:bg-status-lost/10`}
                  >
                    <Trash2 size={14} />
                    Remover do workspace
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Edição inline do cargo (Fundador, Sócio…); vazio volta a mostrar o papel do sistema */
function TitleEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: string;
  onSave: (t: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
      className="mt-2.5 flex gap-1.5"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        maxLength={60}
        list="team-title-suggestions"
        placeholder="Cargo (ex.: Cofundador)"
        className="input-base h-8 min-w-0 flex-1 text-xs"
      />
      <datalist id="team-title-suggestions">
        {TITLE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <button
        type="submit"
        disabled={saving}
        aria-label="Salvar cargo"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-fg/[0.06]"
      >
        <X size={14} />
      </button>
    </form>
  );
}

/** Painel lateral da equipe nas Configurações: cartões dos membros + todas as ações de gestão */
export function TeamPanel() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const { data, isLoading } = useUsers();
  const { data: tenant } = useTenant();
  const updateTenant = useUpdateTenant();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { data: invites = [] } = useTenantInvites(currentUser?.role === 'admin' || currentUser?.role === 'manager');
  const cancelInvite = useCancelInvite();

  const keyPeople = tenant?.key_people ?? [];
  // Ativos primeiro dentro de cada grupo
  const members = [...(data?.data ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active));

  const saveTitle = (member: TeamMember, title: string) => {
    const others = keyPeople.filter((p) => p.email?.toLowerCase() !== member.email.toLowerCase());
    const next: KeyPerson[] = title.trim()
      ? [...others, { name: member.full_name, title: title.trim(), email: member.email }]
      : others;
    updateTenant.mutate(
      { keyPeople: next },
      {
        onSuccess: () => {
          setEditing(null);
          toast.success('Cargo atualizado');
        },
      },
    );
  };

  return (
    <aside className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-bg-border px-4 py-3.5">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Users size={15} className="text-accent-green" />
            Integrantes
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {members.length} membro{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} />
            Adicionar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3 p-3">
          {/* Grupos pelo papel no sistema; cargo personalizado (Fundador…) vira selo no cartão */}
          {groupByTitle(members, (m) => ROLE_LABEL[m.role]).map((g) => (
            <TitleGroup key={g.title} title={g.title}>
              {[...g.items]
                .sort((a, b) => rankOf(titleFor(keyPeople, a.email) ?? g.title) - rankOf(titleFor(keyPeople, b.email) ?? g.title))
                .map((m) => {
                  const title = titleFor(keyPeople, m.email);
                  const isSelf = m.id === currentUser?.id;
                  return (
                    <MemberCard
                      key={m.id}
                      name={isSelf ? `${m.full_name} (você)` : m.full_name}
                      email={m.email}
                      avatarUrl={m.avatar_url}
                      title={title ?? undefined}
                      muted={!m.is_active}
                      meta={m.is_active ? lastAccess(m.last_login_at) : 'Desativado'}
                      actions={isAdmin && <MemberMenu member={m} isSelf={isSelf} onEditTitle={() => setEditing(m.id)} />}
                    >
                      {editing === m.id && (
                        <TitleEditor
                          initial={title ?? ''}
                          saving={updateTenant.isPending}
                          onSave={(t) => saveTitle(m, t)}
                          onCancel={() => setEditing(null)}
                        />
                      )}
                    </MemberCard>
                  );
                })}
            </TitleGroup>
          ))}

          {/* Convidados que ainda não responderam */}
          {invites.length > 0 && (
            <TitleGroup title="Convites pendentes">
              {invites.map((i) => (
                <MemberCard
                  key={i.id}
                  name={i.full_name ?? i.email}
                  email={i.full_name ? i.email : 'Ainda sem conta no TitanFlow'}
                  avatarUrl={i.avatar_url}
                  title={ROLE_LABEL[i.role]}
                  muted
                  meta="Aguardando resposta"
                  actions={
                    isAdmin && (
                      <button
                        type="button"
                        onClick={() => cancelInvite.mutate(i.id)}
                        disabled={cancelInvite.isPending}
                        title="Cancelar convite"
                        aria-label="Cancelar convite"
                        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-status-lost/10 hover:text-status-lost"
                      >
                        <X size={14} />
                      </button>
                    )
                  }
                />
              ))}
            </TitleGroup>
          )}
        </div>
      )}

      <AddMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </aside>
  );
}
