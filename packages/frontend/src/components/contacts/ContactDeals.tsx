import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { useDeals } from '@/hooks/useDeals';
import { Badge } from '@/components/ui/Badge';

type BadgeVariant = 'green' | 'blue' | 'default';

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  open: { label: 'Em aberto', variant: 'blue' },
  won: { label: 'Ganho', variant: 'green' },
  lost: { label: 'Perdido', variant: 'default' },
};

interface DealRow {
  id: string;
  title: string;
  status: string;
  value: string | number | null;
}

/** Negócios do contato no pipeline (mostra o resultado de "Enviar para o pipeline" e evita duplicar) */
export function ContactDeals({ contactId }: { contactId: string }) {
  const { data } = useDeals({ contact: contactId, limit: 50 });
  const deals: DealRow[] = data?.data ?? [];
  if (deals.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Briefcase size={14} className="text-accent-green" /> Negócios no pipeline
      </h3>
      <ul className="divide-y divide-bg-border">
        {deals.map((d) => {
          const status = STATUS[d.status] ?? STATUS.open;
          return (
            <li key={d.id}>
              <Link to={`/deals/${d.id}`} className="flex items-center gap-2 py-2 text-sm hover:text-accent-green">
                <span className="min-w-0 flex-1 truncate text-text-primary">{d.title}</span>
                <span className="tabular-nums text-xs text-text-muted">
                  {Number(d.value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </span>
                <Badge variant={status.variant}>{status.label}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
