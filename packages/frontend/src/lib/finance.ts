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

/**
 * Valor digitado em reais → número. Aceita "1.234,56", "1234,5", "1500.5" e "1.234"; inválido ou negativo → null.
 * Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é decimal (até 2 casas) ou milhar (grupos de 3).
 */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(/^R\$\s*/, '');
  if (!t) return null;
  let normalized: string;
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, '');
  else normalized = t;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Número → texto do campo de valor ("1500,5" → "1500,50") */
export function moneyInput(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** '2026-10-05' → '05/10/2026' */
export function formatDate(iso: string): string {
  return iso.split('-').reverse().join('/');
}
