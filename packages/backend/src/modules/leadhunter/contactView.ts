import { getContact } from '../contacts/contacts.service';
import { PRIORITY_LABELS, type Analysis, type CompanyData, type Priority } from './domain';
import * as store from './store';

// Dados do LeadHunter exibidos na ficha do contato, visíveis a quem enxerga o contato (qualquer papel).
// A cópia é por lista de campos: notas internas, etapa, envio ao CRM, procedência e custos ficam de fora
// (são do operador/admin do LeadHunter).

export interface LeadHunterInfo {
  name: string;
  category: string | null;
  city: string | null;
  borough: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  collectedAt: string;
  instagram: string | null;
  instagramStatus: CompanyData['instagramStatus'];
  instagramCandidates: CompanyData['instagramCandidates'];
  analysis: null | {
    score: number;
    priority: Priority;
    priorityLabel: string;
    reasons: Analysis['reasons'];
    completeness: number;
    rankMedian: number | null;
    rankSamples: number;
    visibility: Analysis['visibility'];
    coverage: Analysis['coverage'];
    fitChoice: Analysis['fit']['choice'];
  };
}

/** Lança 404 se o contato não é do workspace; devolve null se ele não veio do LeadHunter ou a empresa sumiu. */
export async function getContactLeadHunter(tenantId: string, contactId: string): Promise<LeadHunterInfo | null> {
  const contact = await getContact(tenantId, contactId);
  if (contact.source !== 'leadhunter' || !contact.external_id) return null;

  const company = await store.companyByIdentity(tenantId, contact.external_id);
  if (!company) return null;

  const { analysis } = company;
  return {
    name: company.name,
    category: company.category ?? null,
    city: company.city ?? null,
    borough: company.borough ?? null,
    address: company.address ?? null,
    phone: company.phone ?? null,
    website: company.website ?? null,
    rating: company.rating ?? null,
    reviews: company.reviews ?? null,
    mapsUrl: company.mapsUrl ?? null,
    collectedAt: company.collectedAt,
    instagram: company.instagram ?? null,
    instagramStatus: company.instagramStatus,
    instagramCandidates: company.instagramCandidates ?? [],
    analysis: analysis
      ? {
          score: analysis.score,
          priority: analysis.priority,
          priorityLabel: PRIORITY_LABELS[analysis.priority],
          reasons: analysis.reasons,
          completeness: analysis.completeness,
          rankMedian: analysis.rankMedian,
          rankSamples: analysis.rankSamples,
          visibility: analysis.visibility,
          coverage: analysis.coverage,
          fitChoice: analysis.fit.choice,
        }
      : null,
  };
}
