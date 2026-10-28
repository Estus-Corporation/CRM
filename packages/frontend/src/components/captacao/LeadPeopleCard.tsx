import { useState } from 'react';
import { Briefcase, Mail, Phone, Plus, Trash2, User, UserRound, Users, X } from 'lucide-react';
import type { LeadPerson } from '@/services/captacao.service';
import { whatsappUrl } from '@/lib/captacao';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { Button } from '@/components/ui/Button';
import { capitalizeName, cn, formatPhone, JOB_TITLE_OPTIONS } from '@/lib/utils';

const EMPTY = { name: '', title: '', phone: '', email: '' };

/**
 * Pessoas de contato do lead: quem o captador conseguiu na ligação (ex.: o atendente passa o
 * contato do dono). Fica ligado à empresa — o admin também vê. Sem `onSave` = só leitura.
 */
export function LeadPeopleCard({
  people,
  onSave,
  saving,
  bare = false,
}: {
  people: LeadPerson[];
  onSave?: (next: LeadPerson[]) => void;
  saving?: boolean;
  /** Sem card nem cabeçalho próprios: dentro de um bloco do Formulário (o botão fica embaixo) */
  bare?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [customTitle, setCustomTitle] = useState(false);
  const editable = !!onSave;

  const add = () => {
    if (!form.name.trim()) {
      setError('Informe o nome');
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('E-mail inválido');
      return;
    }
    const person: LeadPerson = {
      name: form.name.trim(),
      ...(form.title.trim() && { title: form.title.trim() }),
      ...(form.phone.trim() && { phone: form.phone.trim() }),
      ...(form.email.trim() && { email: form.email.trim() }),
    };
    onSave?.([...people, person]);
    setForm(EMPTY);
    setError('');
    setCustomTitle(false);
    setAdding(false);
  };

  const remove = (i: number) => onSave?.(people.filter((_, k) => k !== i));

  const field = 'input-base h-10 w-full pl-9 text-sm';

  const body = (
      <div className={cn('space-y-3', bare ? 'p-4' : 'p-4 md:p-5')}>
        {people.length === 0 && !adding && (
          <p className="text-sm text-text-muted">
            {editable
              ? 'Conseguiu falar com alguém (o dono, o gerente…)? Registre aqui — fica ligado a este lead.'
              : 'Nenhum contato registrado pelo captador ainda.'}
          </p>
        )}

        {people.length > 0 && (
          <ul className="divide-y divide-fg/[0.06] overflow-hidden rounded-xl border border-fg/[0.06]">
            {people.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-fg/[0.07] text-text-secondary">
                  <UserRound size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {p.name}
                    {p.title && <span className="ml-1.5 font-normal text-text-muted">· {p.title}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-text-muted">
                    {p.phone && <span className="tabular-nums">{p.phone}</span>}
                    {p.email && <span className="truncate">{p.email}</span>}
                  </p>
                </div>
                {/* Atalhos: ligar, WhatsApp e e-mail direto pra pessoa */}
                <div className="flex items-center gap-1.5">
                  {p.phone && (
                    <a
                      href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}
                      title={`Ligar para ${p.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-fg/[0.08] text-text-primary transition-colors hover:bg-fg/[0.06]"
                    >
                      <Phone size={14} fill="currentColor" strokeWidth={1} />
                    </a>
                  )}
                  {p.phone && (
                    <a
                      href={whatsappUrl(p.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`WhatsApp de ${p.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-fg/[0.08] text-[#25D366] transition-colors hover:bg-fg/[0.06]"
                    >
                      <WhatsAppIcon size={15} />
                    </a>
                  )}
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      title={`E-mail para ${p.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-fg/[0.08] text-text-secondary transition-colors hover:bg-fg/[0.06]"
                    >
                      <Mail size={14} />
                    </a>
                  )}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={saving}
                      title="Remover contato"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-lost/10 hover:text-status-lost"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Formulário curto pra registrar a pessoa */}
        {adding && (
          <div className="rounded-xl border border-fg/[0.1] bg-fg/[0.03] p-3.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {/* Nome: primeira letra de cada palavra maiúscula */}
              <div className="relative">
                <User size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: capitalizeName(e.target.value) }))}
                  placeholder="Nome *"
                  autoFocus
                  maxLength={120}
                  className={cn(field, error && !form.name.trim() && 'border-status-lost')}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                />
              </div>

              {/* Cargo: opções prontas; "Outro" abre campo livre */}
              <div className="relative">
                <Briefcase size={14} className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-text-muted" />
                {customTitle ? (
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Qual cargo?"
                    autoFocus
                    maxLength={80}
                    className={cn(field, 'pr-9')}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                  />
                ) : (
                  <select
                    value={form.title}
                    onChange={(e) => {
                      if (e.target.value === '__other') {
                        setCustomTitle(true);
                        setForm((f) => ({ ...f, title: '' }));
                      } else setForm((f) => ({ ...f, title: e.target.value }));
                    }}
                    className={cn(field, !form.title && 'text-text-muted')}
                  >
                    <option value="">Cargo</option>
                    {JOB_TITLE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="__other">Outro…</option>
                  </select>
                )}
                {customTitle && (
                  <button
                    type="button"
                    title="Voltar pras opções"
                    onClick={() => {
                      setCustomTitle(false);
                      setForm((f) => ({ ...f, title: '' }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted hover:text-text-primary"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="relative">
                <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                  type="tel"
                  inputMode="tel"
                  placeholder="Telefone / WhatsApp"
                  className={field}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                />
              </div>

              {/* E-mail sempre minúsculo */}
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  placeholder="E-mail"
                  maxLength={255}
                  className={field}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {error && <span className="mr-auto text-xs text-status-lost">{error}</span>}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setForm(EMPTY);
                  setError('');
                  setCustomTitle(false);
                }}
              >
                <X size={14} />
                Cancelar
              </Button>
              <Button size="sm" onClick={add} disabled={saving}>
                <Plus size={14} />
                Salvar contato
              </Button>
            </div>
          </div>
        )}

        {/* Dentro do Formulário o botão de adicionar fica embaixo da lista */}
        {bare && editable && !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Adicionar contato
          </Button>
        )}
      </div>
  );

  if (bare) return body;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3.5 md:px-5">
        <Users size={16} className="text-accent-green" />
        <h2 className="text-sm font-semibold text-text-primary">Contatos do lead</h2>
        {people.length > 0 && <span className="text-xs text-text-muted">· {people.length}</span>}
        {editable && !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)} className="ml-auto">
            <Plus size={14} />
            Adicionar contato
          </Button>
        )}
      </div>

      {body}
    </div>
  );
}
