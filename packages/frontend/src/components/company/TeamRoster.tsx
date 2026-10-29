import type { ReactNode } from 'react';
import { Briefcase, Headset, Mail, Shield, ShieldCheck, UserX, Users, type LucideIcon } from 'lucide-react';
import type { KeyPerson, TenantMember } from '@/hooks/useTenant';
import { Avatar } from '@/components/ui/Avatar';
import { useOnlineIds } from '@/hooks/usePresence';
import { cn } from '@/lib/utils';

export const ROLE_LABEL: Record<TenantMember['role'], string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
  captador: 'Captador',
};

// Cargos de liderança ganham o selo verde
export const LEAD_TITLE = /fundador|fundadora|ceo|s[óo]ci[oa]|diretor/i;

// Ordem dos grupos: liderança primeiro, depois os papéis do sistema; cargos desconhecidos no fim
const TITLE_RANK: [RegExp, number][] = [
  [/^fundador/i, 0],
  [/^co-?fundador/i, 1],
  [/^ceo/i, 2],
  [/^s[óo]ci/i, 3],
  [/^diretor/i, 4],
  [/^admin/i, 5],
  [/^gerente/i, 6],
  [/^vendedor/i, 7],
  [/^captador/i, 8],
];
export const rankOf = (title: string) => TITLE_RANK.find(([re]) => re.test(title))?.[1] ?? 9;

/** Agrupa por cargo (sem diferenciar maiúsculas), na ordem de TITLE_RANK */
export function groupByTitle<T>(items: T[], getTitle: (item: T) => string) {
  const groups = new Map<string, { title: string; items: T[] }>();
  for (const item of items) {
    const title = getTitle(item);
    const key = title.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { title, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()].sort((a, b) => rankOf(a.title) - rankOf(b.title));
}

const GROUP_ICON: [RegExp, LucideIcon][] = [
  [/^admin/i, Shield],
  [/^gerente/i, ShieldCheck],
  [/^vendedor/i, Briefcase],
  [/^captador/i, Headset],
  [/^sem conta/i, UserX],
];

/** Bloco de um grupo: cabeçalho com ícone do papel, integrantes dentro */
export function TitleGroup({ title, children }: { title: string; children: ReactNode }) {
  const Icon = GROUP_ICON.find(([re]) => re.test(title))?.[1] ?? Users;
  const lead = /^admin/i.test(title);
  return (
    <section className="overflow-hidden rounded-2xl border border-fg/[0.07] bg-fg/[0.015]">
      <header className="flex items-center gap-2.5 border-b border-fg/[0.06] bg-fg/[0.03] px-3 py-2.5">
        <span
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
            lead ? 'bg-accent-green/15 text-accent-green' : 'bg-fg/[0.07] text-text-secondary',
          )}
        >
          <Icon size={14} />
        </span>
        <span className="text-sm font-semibold text-text-primary">{title}</span>
      </header>
      <ul className="grid gap-2 p-2">
        {children}
      </ul>
    </section>
  );
}


/** Cargo personalizado do membro (cadastrado pelo e-mail em key_people), se houver */
export function titleFor(keyPeople: KeyPerson[] = [], email: string) {
  return keyPeople.find((p) => p.email?.toLowerCase() === email.toLowerCase())?.title ?? null;
}

interface MemberCardProps {
  name: string;
  /** Bolinha verde de online na foto */
  online?: boolean;
  email?: string | null;
  avatarUrl?: string | null;
  /** Selo de cargo; omitido quando o cartão já está dentro do grupo do cargo */
  title?: string;
  meta?: string;
  muted?: boolean;
  /** Canto superior direito (menu de ações) */
  actions?: ReactNode;
  /** Conteúdo extra embaixo (ex.: edição de cargo) */
  children?: ReactNode;
}

/** Cartão de integrante: foto, nome, selo de cargo, e-mail e uma linha de detalhes */
export function MemberCard({ name, email, avatarUrl, title, meta, muted, actions, children, online }: MemberCardProps) {
  return (
    <li className={cn('relative rounded-xl border border-fg/[0.06] bg-bg-surface/40 p-3', muted && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatarUrl} online={online} className="h-11 w-11 flex-shrink-0" />
        <div className={cn('min-w-0 flex-1', actions && 'pr-7')}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
            {title && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  LEAD_TITLE.test(title) ? 'bg-accent-green/15 text-accent-green' : 'bg-fg/[0.07] text-text-secondary',
                )}
              >
                {title}
              </span>
            )}
          </div>
          {email && (
            <a
              href={`mailto:${email}`}
              className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-muted transition-colors hover:text-accent-green"
            >
              <Mail size={11} className="flex-shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          )}
          {meta && <p className="mt-0.5 text-[11px] text-text-muted">{meta}</p>}
        </div>
      </div>
      {actions && <div className="absolute right-2 top-2">{actions}</div>}
      {children}
    </li>
  );
}

/**
 * Membros do workspace (automático) + cargos de key_people. Quem tem cargo cadastrado pelo
 * e-mail usa esse cargo; pessoas listadas sem conta no workspace aparecem no fim.
 */
export function buildRoster(members: TenantMember[] = [], keyPeople: KeyPerson[] = []) {
  const memberEmails = new Set(members.map((m) => m.email.toLowerCase()));
  // group = papel no sistema (Admin, Captador…); title = cargo personalizado, vira selo no cartão
  const entries = members.map((m) => ({
    key: m.id,
    name: m.full_name,
    email: m.email as string | null,
    avatarUrl: m.avatar_url,
    group: ROLE_LABEL[m.role],
    title: titleFor(keyPeople, m.email) ?? undefined,
    meta: '',
  }));
  keyPeople
    .filter((p) => !p.email || !memberEmails.has(p.email.toLowerCase()))
    .forEach((p, i) =>
      entries.push({
        key: `kp-${i}`,
        name: p.name,
        email: p.email || null,
        avatarUrl: null,
        group: 'Sem conta no espaço',
        title: p.title,
        meta: '',
      }),
    );
  return entries;
}

/** Integrantes agrupados pelo papel (Admin, Gerente…); fundador/cofundador aparecem como selo */
export function TeamRoster({ members, keyPeople, className }: { members?: TenantMember[]; keyPeople?: KeyPerson[]; className?: string }) {
  const roster = buildRoster(members, keyPeople);
  const onlineIds = useOnlineIds();
  if (roster.length === 0) return null;
  return (
    <div className={cn('space-y-3', className)}>
      {groupByTitle(roster, (p) => p.group).map((g) => (
        <TitleGroup key={g.title} title={g.title}>
          {/* Liderança no topo do grupo */}
          {[...g.items]
            .sort((a, b) => rankOf(a.title ?? g.title) - rankOf(b.title ?? g.title))
            .map(({ key, group: _group, meta, ...p }) => (
              <MemberCard key={key} {...p} meta={meta || undefined} online={onlineIds.has(key)} />
            ))}
        </TitleGroup>
      ))}
    </div>
  );
}
