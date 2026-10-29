import type { CallStatus, LostReason, WhatsappStatus } from '@/services/captacao.service';

/** Resultados da ligação, na ordem em que aparecem para o captador */
/** Plano B (WhatsApp): situação da mensagem */
export const WHATSAPP_STATUS: Record<WhatsappStatus, { label: string; className: string; dot: string }> = {
  // 'waiting' = mensagem enviada, sem resposta registrada ainda
  waiting: { label: 'Mensagem enviada', className: 'bg-accent-amber/15 text-accent-amber', dot: 'bg-accent-amber' },
  replied: { label: 'Respondeu', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green' },
  no_reply: { label: 'Sem resposta', className: 'bg-fg/[0.09] text-text-primary', dot: 'bg-text-secondary' },
  no_whatsapp: { label: 'Sem WhatsApp', className: 'bg-status-lost/15 text-status-lost', dot: 'bg-status-lost' },
};
// Opções do captador: só a resposta ('waiting' = enviada, marcado sozinho ao abrir o WhatsApp)
export const WHATSAPP_STATUS_ORDER: WhatsappStatus[] = ['replied', 'no_reply', 'no_whatsapp'];

export const CALL_STATUS: Record<CallStatus, { label: string; short: string; className: string; dot: string }> = {
  // Paleta de 3 cores (esmeralda/âmbar/vermelho): "a ligar" tracejado = ainda não ligou; "não atendeu" neutro
  pending: { label: 'A ligar', short: 'A ligar', className: 'border border-dashed border-fg/[0.22] text-text-muted', dot: 'bg-text-muted' },
  no_answer: { label: 'Não atendeu', short: 'Não atendeu', className: 'bg-fg/[0.09] text-text-primary', dot: 'bg-text-secondary' },
  wrong_number: { label: 'Número errado', short: 'Nº errado', className: 'bg-status-lost/15 text-status-lost', dot: 'bg-status-lost' },
  answered: { label: 'Atendeu', short: 'Atendeu', className: 'bg-accent-green/10 text-text-primary', dot: 'bg-accent-green' },
  callback: { label: 'Em aguardo', short: 'Aguardo', className: 'bg-accent-amber/15 text-accent-amber', dot: 'bg-accent-amber' },
  meeting: { label: 'Reunião marcada', short: 'Reunião', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green' },
  lost: { label: 'Perdido', short: 'Perdido', className: 'bg-status-lost/15 text-status-lost', dot: 'bg-status-lost' },
};

// Sem 'callback': o "Em aguardo" agora é o botão ao lado de "Concluir lead" (on_hold_at). O valor segue
// existindo só pra leads antigos que já têm esse resultado.
export const CALL_STATUS_ORDER: CallStatus[] = ['pending', 'no_answer', 'answered', 'wrong_number', 'meeting', 'lost'];

// Opções do Resultado na página do lead (reunião sai da Agenda; perdido quem decide é o admin)
export const CALL_RESULT_OPTIONS = ['no_answer', 'answered', 'wrong_number'] as const satisfies readonly CallStatus[];

/** Motivos de perda (escolhidos ao marcar "Perdeu") */
export const LOST_REASON_LABEL: Record<LostReason, string> = {
  no_interest: 'Sem interesse',
  has_supplier: 'Já tem fornecedor',
  price: 'Preço',
  wrong_number: 'Número errado',
  closed_business: 'Empresa fechada',
  other: 'Outro motivo',
};
export const LOST_REASONS = Object.keys(LOST_REASON_LABEL) as LostReason[];

export function formatBRL(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

/** Lê valor digitado em pt-BR ("12.500,50") ou com ponto decimal ("12500.50"); NaN se inválido */
export function parseMoney(input: string) {
  const s = input.trim();
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  // Só pontos: "12.500" / "1.250.000" são milhares; "12500.5" é decimal
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

/** Datas "YYYY-MM-DD" do banco: formata sem passar por fuso (evita voltar um dia) */
export function formatDay(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Instagram vem como "@perfil", "perfil" ou link completo */
export function instagramUrl(value: string) {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, '').replace(/^(www\.)?instagram\.com\//i, '')}`;
}

export function instagramHandle(value: string) {
  const v = value.trim().replace(/\/+$/, '');
  const fromUrl = v.match(/instagram\.com\/([^/?#]+)/i);
  return `@${(fromUrl ? fromUrl[1] : v).replace(/^@/, '')}`;
}

/** Site sem protocolo ganha https:// */
export function websiteUrl(value: string) {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function websiteLabel(value: string) {
  return value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

/** Página do Google do lugar: o link que veio do LeadHunter, ou uma busca no Maps por nome + endereço */
export function googleUrl(lead: { maps_url: string | null; full_name: string; company_name: string | null; address: string | null }) {
  if (lead.maps_url) return lead.maps_url;
  const query = [lead.company_name || lead.full_name, lead.address].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Link do WhatsApp a partir de um telefone brasileiro em qualquer formato */
export function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

export type LeadPain = 'no_site' | 'no_instagram' | 'no_marketing' | 'no_google' | 'few_reviews' | 'low_rating';

export const LEAD_PAIN_LABEL: Record<LeadPain, string> = {
  no_site: 'Sem site',
  no_instagram: 'Sem Instagram',
  no_marketing: 'Sem marketing digital',
  no_google: 'Sem perfil no Google',
  few_reviews: 'Poucas avaliações',
  low_rating: 'Nota baixa no Google',
};

/** Frase pronta pra puxar a conversa a partir de cada dor (roteiro da ligação) */
export const LEAD_PAIN_SCRIPT: Record<LeadPain, string> = {
  no_site: 'Vi que vocês ainda não têm site. Hoje muita gente procura antes de comprar, e sem site esse cliente vai pro concorrente.',
  no_instagram: 'Notei que vocês ainda não têm Instagram. É onde boa parte dos clientes de vocês descobre lojas novas.',
  no_marketing: 'Vocês ainda não aparecem muito na internet. Dá pra trazer clientes novos sem depender só de quem passa na porta.',
  no_google: 'Não encontrei vocês no Google Maps. Quem procura "perto de mim" acaba achando só os concorrentes.',
  few_reviews: 'Vocês têm poucas avaliações no Google. Mais avaliações passam confiança e fazem vocês aparecerem antes.',
  low_rating: 'A nota de vocês no Google está abaixo do que poderia. Dá pra melhorar isso e atrair mais clientes.',
};

/**
 * Possíveis dores do lead (argumentos de venda), deduzidas do que se sabe do lugar:
 * sem site, sem Instagram, pouca presença ou nota baixa no Google.
 */
export function leadPains(lead: {
  website: string | null;
  instagram: string | null;
  maps_url: string | null;
  google_rating: number | null;
  google_reviews: number | null;
}): LeadPain[] {
  const pains: LeadPain[] = [];
  if (!lead.website) pains.push('no_site');
  if (!lead.instagram) pains.push('no_instagram');
  if (!lead.website && !lead.instagram) pains.push('no_marketing');
  if (!lead.maps_url && lead.google_rating === null) pains.push('no_google');
  else if (lead.google_reviews !== null && lead.google_reviews < 20) pains.push('few_reviews');
  if (lead.google_rating !== null && lead.google_rating < 4) pains.push('low_rating');
  return pains;
}
