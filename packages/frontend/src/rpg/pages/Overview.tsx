import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, LayoutGrid, PackageCheck, Radar, Receipt, Sparkles } from 'lucide-react';
import { EXPENSE_CATEGORIES, UNIVERSES, brl, dayKey, wishCategoryOf } from '../data';
import { monthOf, useRpg, useStats } from '../store';
import { ItemImage, Panel, ProgressBar, RadarPanelChart } from '../ui';

const short = (label: string) => label.split(' ')[0];

export function Overview() {
  const s = useRpg();
  const st = useStats();
  const universeOfCol = new Map(s.collections.map((c) => [c.id, c.universe]));
  const iconOf = (collectionId: string) => UNIVERSES.find((u) => u.key === universeOfCol.get(collectionId))?.icon ?? Sparkles;
  const thingIds = new Set(s.collections.filter((c) => c.kind === 'things').map((c) => c.id));
  const recent = s.items.filter((i) => thingIds.has(i.collectionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const wishes = s.wishlist.filter((w) => !w.boughtAt).slice(0, 4);

  const month = dayKey().slice(0, 7);
  const monthExpenses = s.expenses.filter((e) => monthOf(e.date) === month);
  const topCategories = EXPENSE_CATEGORIES.map((c) => ({ ...c, value: monthExpenses.filter((e) => e.category === c.key).reduce((n, e) => n + e.amount, 0) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  const stats = [
    { label: 'Coisas', value: st.things },
    { label: 'Em andamento', value: st.doing },
    { label: 'Na wishlist', value: st.wishes },
    { label: st.monthlyIncome ? 'Saldo do mês' : 'Gastos no mês', value: brl(st.monthlyIncome ? st.monthBalance : st.monthSpent) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="relative overflow-hidden rounded-[22px] border border-fg/[0.1] bg-[radial-gradient(ellipse_at_85%_0%,rgba(40,80,200,0.25),transparent_60%),#05070D] p-5 md:p-7 lg:col-span-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Visão geral</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.01em] text-text-primary md:text-[34px]">{s.name}</h1>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((x) => (
            <div key={x.label} className="min-w-0">
              <p className="truncate text-xl font-semibold tabular-nums text-text-primary">{x.value}</p>
              <p className="text-[11px] text-text-muted">{x.label}</p>
            </div>
          ))}
        </div>
      </section>

      <Panel icon={LayoutGrid} title="Universos" subtitle="Registros e progresso das listas e metas" className="lg:col-span-7">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {UNIVERSES.map((u, i) => {
            const us = st.universes[u.key];
            const Icon = u.icon;
            return (
              <motion.div key={u.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}>
                <Link to={`/universos/${u.key}`} className="flex h-full flex-col rounded-2xl border border-fg/[0.08] bg-fg/[0.03] p-3 transition-colors hover:bg-fg/[0.06]">
                  <Icon size={20} strokeWidth={1.8} className="text-text-primary" />
                  <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-text-primary">{u.label}</p>
                  <p className="text-[11px] text-text-muted">{us.total} {us.total === 1 ? 'registro' : 'registros'}{us.done + us.doing + us.todo ? ` · ${us.pct}%` : ''}</p>
                  <div className="mt-auto pt-2.5"><ProgressBar value={us.pct} max={100} tone="white" className="h-1" /></div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      <Panel icon={Radar} title="Quem você é hoje" subtitle={`Progresso nas listas e metas: ${st.lifePct}%`} className="lg:col-span-5">
        <RadarPanelChart height={300} data={UNIVERSES.map((u) => ({ label: short(u.label), value: st.universes[u.key].pct }))} />
      </Panel>

      <Panel icon={Gift} title="Wishlist" subtitle={st.wishes ? `${brl(st.wishTotal)} no total` : undefined} className="lg:col-span-4"
        action={<Link to="/wishlist" className="text-xs font-medium text-accent-green hover:underline">Ver tudo</Link>}>
        {wishes.length ? (
          <ul className="space-y-2">
            {wishes.map((w) => {
              const c = wishCategoryOf(w.category);
              return (
                <li key={w.id}>
                  <Link to={`/wishlist?cat=${w.category}`} className="flex items-center gap-3 rounded-xl transition-colors hover:bg-fg/[0.03]">
                    <ItemImage src={w.image} icon={c.icon} className="h-11 w-11 flex-shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{w.name}</p>
                      <p className="truncate text-xs text-text-muted">{c.label}{w.price != null ? ` · ${brl(w.price)}` : ''}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-text-muted">Sua wishlist está vazia. <Link to="/wishlist" className="text-text-secondary underline">Adicionar desejo</Link></p>
        )}
      </Panel>

      <Panel icon={Receipt} title="Gastos do mês" subtitle={brl(st.monthSpent)} className="lg:col-span-4"
        action={<Link to="/universos/finance" className="text-xs font-medium text-accent-green hover:underline">Abrir</Link>}>
        {topCategories.length ? (
          <ul className="space-y-3">
            {topCategories.map((c) => (
              <li key={c.key}>
                <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                  <c.icon size={14} className="flex-shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate text-text-secondary">{c.label}</span>
                  <span className="tabular-nums text-text-primary">{brl(c.value)}</span>
                </div>
                <ProgressBar value={c.value} max={topCategories[0].value} tone="white" className="h-1.5" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-text-muted">Nenhum gasto lançado este mês. <Link to="/universos/finance" className="text-text-secondary underline">Lançar gasto</Link></p>
        )}
      </Panel>

      <Panel icon={PackageCheck} title="Últimas coisas adicionadas" className="lg:col-span-4">
        {recent.length ? (
          <div className="grid grid-cols-3 gap-2.5">
            {recent.map((i) => (
              <div key={i.id} className="min-w-0">
                <ItemImage src={i.image} icon={iconOf(i.collectionId)} className="aspect-square w-full rounded-xl border border-fg/[0.08]" />
                <p className="mt-1 truncate text-center text-[11.5px] text-text-secondary">{i.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-text-muted">Nada por aqui ainda. Abra um universo (Auto-Cuidado, Ambiente…) e cadastre o que você tem.</p>
        )}
      </Panel>
    </div>
  );
}
