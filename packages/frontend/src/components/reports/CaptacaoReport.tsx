import { Headset, CalendarCheck, Inbox, Percent, Trophy, User, Wallet } from 'lucide-react';
import { HeadLabel } from '@/components/ui/HeadLabel';
import { useCaptadores } from '@/hooks/useCaptacao';
import { CardHeader } from '@/components/dashboard/CardHeader';
import { Spinner } from '@/components/ui/Spinner';
import { cn, shortName } from '@/lib/utils';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);

/** Taxa com cor: verde quando boa, âmbar média, apagada sem base */
function Rate({ value, good, ok }: { value: number | null; good: number; ok: number }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  return (
    <span
      className={cn(
        'inline-flex min-w-[46px] justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        value >= good ? 'bg-accent-green/15 text-accent-green' : value >= ok ? 'bg-accent-amber/15 text-accent-amber' : 'bg-fg/[0.06] text-text-secondary',
      )}
    >
      {value}%
    </span>
  );
}

/**
 * Relatório da captação: a conversão de cada captador, do lead recebido ao negócio fechado.
 * (A aba Equipe da Captação mostra os números do dia a dia; aqui são as taxas, pra comparar.)
 */
export function CaptacaoReport() {
  const { data: captadores = [], isLoading } = useCaptadores();
  const rows = captadores
    .map((c) => {
      const called = c.total - c.pending;
      return { ...c, called, contactRate: pct(called, c.total), meetingRate: pct(c.meetings + c.won, called), closeRate: pct(c.won, c.meetings + c.won) };
    })
    .sort((a, b) => b.won_value - a.won_value || b.meetings - a.meetings);

  const t = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      called: acc.called + r.called,
      meetings: acc.meetings + r.meetings,
      won: acc.won + r.won,
      value: acc.value + Number(r.won_value),
      commission: acc.commission + Number(r.commission_pending) + Number(r.commission_paid),
    }),
    { total: 0, called: 0, meetings: 0, won: 0, value: 0, commission: 0 },
  );

  // Funil da captação inteira (todos os captadores somados)
  const steps = [
    { label: 'Leads recebidos', value: t.total },
    { label: 'Ligados', value: t.called },
    { label: 'Reuniões', value: t.meetings + t.won },
    { label: 'Fechados', value: t.won },
  ];

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <CardHeader icon={Headset} title="Funil da captação" />
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {steps.map((s, i) => {
              const conv = i > 0 ? pct(s.value, steps[i - 1].value) : null;
              return (
                <div key={s.label} className="rounded-xl border border-fg/[0.06] bg-fg/[0.025] p-4">
                  <p className="text-[12px] font-medium text-text-muted">{s.label}</p>
                  <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-text-primary">{s.value}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {conv === null ? 'ponto de partida' : <><strong className="font-semibold text-text-secondary">{conv}%</strong> da etapa anterior</>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <CardHeader icon={Headset} title="Conversão por captador" />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="px-5 pb-8 text-center text-sm text-text-muted">Nenhum captador no workspace.</p>
        ) : (
          <div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-5 py-3 text-left font-medium"><HeadLabel icon={Headset}>Captador</HeadLabel></th>
                  <th className="px-4 py-3 text-right font-medium"><HeadLabel icon={Inbox}>Leads</HeadLabel></th>
                  <th className="hidden px-4 py-3 text-center font-medium md:table-cell"><HeadLabel icon={User}>Contato</HeadLabel></th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell"><HeadLabel icon={CalendarCheck}>Reuniões</HeadLabel></th>
                  <th className="px-4 py-3 text-center font-medium"><HeadLabel icon={Percent}>Taxa reunião</HeadLabel></th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell"><HeadLabel icon={Trophy}>Fechados</HeadLabel></th>
                  <th className="px-4 py-3 text-center font-medium"><HeadLabel icon={Percent}>Taxa fechamento</HeadLabel></th>
                  <th className="px-5 py-3 text-right font-medium"><HeadLabel icon={Wallet}>Receita gerada</HeadLabel></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn('border-b border-bg-border last:border-0', !r.is_active && 'opacity-60')}>
                    <td className="px-5 py-3 font-medium text-text-primary">
                      {shortName(r.full_name)}
                      {!r.is_active && <span className="ml-1.5 text-xs font-normal text-text-muted">(inativo)</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{r.total}</td>
                    <td className="hidden px-4 py-3 text-center md:table-cell" title="Leads já ligados sobre os recebidos">
                      <Rate value={r.contactRate} good={80} ok={50} />
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-text-secondary md:table-cell">{r.meetings + r.won}</td>
                    <td className="px-4 py-3 text-center" title="Reuniões sobre os leads ligados">
                      <Rate value={r.meetingRate} good={20} ok={10} />
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-text-secondary md:table-cell">{r.won}</td>
                    <td className="px-4 py-3 text-center" title="Negócios fechados sobre as reuniões">
                      <Rate value={r.closeRate} good={30} ok={15} />
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-accent-green">{brl(Number(r.won_value))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-fg/[0.1] text-text-primary">
                  <td className="px-5 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{t.total}</td>
                  <td className="hidden px-4 py-3 text-center md:table-cell"><Rate value={pct(t.called, t.total)} good={80} ok={50} /></td>
                  <td className="hidden px-4 py-3 text-right font-semibold tabular-nums md:table-cell">{t.meetings + t.won}</td>
                  <td className="px-4 py-3 text-center"><Rate value={pct(t.meetings + t.won, t.called)} good={20} ok={10} /></td>
                  <td className="hidden px-4 py-3 text-right font-semibold tabular-nums md:table-cell">{t.won}</td>
                  <td className="px-4 py-3 text-center"><Rate value={pct(t.won, t.meetings + t.won)} good={30} ok={15} /></td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-accent-green">{brl(t.value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-fg/[0.06] px-5 py-3 text-xs text-text-muted">
          Comissões geradas no total: <strong className="font-semibold text-text-secondary">{brl(t.commission)}</strong> · taxas calculadas sobre todos os
          leads já entregues a cada captador.
        </p>
      </div>
    </div>
  );
}
