import { Mail, Plus, X } from 'lucide-react';
import type { KeyPerson } from '@/hooks/useTenant';

const TITLE_SUGGESTIONS = ['Fundador', 'Fundadora', 'Cofundador', 'Cofundadora', 'Sócio', 'CEO', 'Gerente', 'Vendedor', 'Captador'];

export interface MemberOption {
  name: string;
  email: string;
}

interface Props {
  value: KeyPerson[];
  onChange: (people: KeyPerson[]) => void;
  /** Membros do workspace: digitar o e-mail de um deles preenche o nome */
  members?: MemberOption[];
}

/** Lista "quem é quem" do workspace: nome + cargo + e-mail (opcional), com sugestões */
export function KeyPeopleEditor({ value, onChange, members = [] }: Props) {
  const set = (i: number, patch: Partial<KeyPerson>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const setEmail = (i: number, email: string) => {
    const member = members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase());
    set(i, member && !value[i].name.trim() ? { email, name: member.name } : { email });
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-medium text-text-secondary">Cargos (fundador, cofundador, sócio…)</span>
        <p className="text-xs text-text-muted">
          Os membros do espaço já aparecem sozinhos. Use o e-mail de um membro para dar um cargo a ele, ou adicione quem ainda não tem conta.
        </p>
      </div>
      {value.map((p, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-2 sm:grid-cols-[1.1fr_0.9fr_1.3fr_auto]"
        >
          <input
            value={p.name}
            onChange={(e) => set(i, { name: e.target.value })}
            maxLength={120}
            placeholder="Nome"
            className="input-base h-10 min-w-0 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label="Remover pessoa"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-status-lost sm:order-last"
          >
            <X size={15} />
          </button>
          <input
            value={p.title}
            onChange={(e) => set(i, { title: e.target.value })}
            maxLength={60}
            placeholder="Cargo"
            list="key-people-titles"
            className="input-base col-span-2 h-10 min-w-0 text-sm sm:col-span-1"
          />
          <div className="relative col-span-2 sm:col-span-1">
            <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              value={p.email ?? ''}
              onChange={(e) => setEmail(i, e.target.value)}
              maxLength={255}
              placeholder="E-mail (opcional)"
              list="key-people-emails"
              className="input-base h-10 w-full min-w-0 pl-8 text-sm"
            />
          </div>
        </div>
      ))}
      <datalist id="key-people-titles">
        {TITLE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="key-people-emails">
        {members.map((m) => (
          <option key={m.email} value={m.email}>
            {m.name}
          </option>
        ))}
      </datalist>
      <button
        type="button"
        onClick={() => onChange([...value, { name: '', title: value.length === 0 ? 'Fundador' : '', email: '' }])}
        className="flex h-9 w-fit items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green/10"
      >
        <Plus size={14} />
        Adicionar pessoa (cofundador, sócio, captador…)
      </button>
    </div>
  );
}

/** Descarta linhas incompletas antes de salvar */
export function cleanKeyPeople(people: KeyPerson[]) {
  return people
    .map((p) => ({ name: p.name.trim(), title: p.title.trim(), email: p.email?.trim() || undefined }))
    .filter((p) => p.name && p.title);
}
