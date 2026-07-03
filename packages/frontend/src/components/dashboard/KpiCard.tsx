interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="card p-4 space-y-1.5">
      <p className="text-[11px] text-text-secondary uppercase tracking-wide truncate">{label}</p>
      <p className="text-3xl font-semibold text-text-primary tabular-nums truncate">{value}</p>
      {sub && <p className="text-xs text-text-muted truncate">{sub}</p>}
    </div>
  );
}
