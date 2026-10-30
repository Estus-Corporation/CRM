const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Mês atual (YYYY-MM) no fuso de Brasília, o mesmo que o backend usa para fechar o mês */
export function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 7);
}

/** Soma (ou subtrai) meses a um YYYY-MM */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const total = year * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** '2026-10' → 'Out/2026' */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]}/${year}`;
}

/** Valor completo em reais (o financeiro não usa a notação compacta) */
export function formatBRL(value: number): string {
  return brl.format(value);
}
