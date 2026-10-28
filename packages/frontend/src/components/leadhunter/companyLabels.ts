import type { Fit, InstagramStatus, LeadHunterPriority, LeadHunterStage } from '@/services/leadhunter.service';

// Rótulos e formatos da ficha da empresa, iguais aos do LeadHunter (web/app.js).

export const PRIORITY_LABEL: Record<LeadHunterPriority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
  review: 'Em revisão',
  excluded: 'Fora do perfil',
};

export const STAGE_LABEL: Record<LeadHunterStage, string> = {
  new: 'Novo lead',
  reviewing: 'Em análise',
  contacted: 'Contatado',
  interested: 'Interessado',
  discarded: 'Descartado',
  do_not_contact: 'Não contatar',
};

export const INSTAGRAM_LABEL: Record<InstagramStatus, string> = {
  not_searched: 'Não pesquisado',
  not_found: 'Não localizado',
  candidate: 'Candidato · revisar',
  confirmed: 'Confirmado pelo operador',
  rejected: 'Candidato rejeitado',
  error: 'Pesquisa incompleta',
};

export const CRM_LABEL = { imported: 'Criado', duplicate: 'Já existia', error: 'Erro' } as const;

export const NOTES_MAX = 5000;

export const formatNumber = (value: number | null | undefined) => (value == null ? '—' : value.toLocaleString('pt-BR'));

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

/** +5516992386188 → +55 16 99238-6188; o que não casar volta como veio */
export function formatBrPhone(value: string | null): string {
  if (!value) return '';
  const m = /^\+55(\d{2})(9\d{4}|[2-5]\d{3})-?(\d{4})$/.exec(value.trim());
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : value;
}

/** Só http/https viram link; qualquer outra coisa (javascript:, data:) vira texto */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function fitLabel(fit: Fit | undefined): string {
  if (fit?.method === 'jev') return `Jev ${fit.model ?? ''} · confiança ${Math.round((fit.confidence ?? 0) * 100)}%`;
  if (fit?.method === 'error') return 'Jev indisponível · revisão necessária';
  return 'Regras locais · sem avaliação de IA';
}
