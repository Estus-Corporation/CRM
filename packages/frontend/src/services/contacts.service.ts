import { api } from './api';
import { useAuthStore } from '@/store/authStore';

/** Linha de importação em lote (agenda do celular ou planilha de leads) */
export interface BulkContact {
  fullName: string;
  phone?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  niche?: string;
  source?: string;
  address?: string;
  mapsUrl?: string;
  instagram?: string;
  website?: string;
  googleRating?: number;
  googleReviews?: number;
  leadContext?: string;
}

export interface Contact {
  id: string;
  type: 'lead' | 'contact' | 'client';
  full_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  job_title?: string;
  source?: string;
  niche?: string | null;
  tags: string[];
  owner_id?: string;
  owner_name?: string;
  tenant_id: string;
  has_photo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  type?: 'lead' | 'contact' | 'client';
  fullName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
  source?: string;
  niche?: string;
  tags?: string[];
  ownerId?: string;
}

export interface ContactsListParams {
  type?: string;
  owner?: string;
  search?: string;
  niche?: string;
  page?: number;
  limit?: number;
}

export const contactsService = {
  list: (params?: ContactsListParams) =>
    api.get('/contacts', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/contacts/${id}`).then((r) => r.data.data as Contact),
  listNiches: () => api.get('/contacts/niches').then((r) => r.data.data as string[]),
  create: (input: CreateContactInput) =>
    api.post('/contacts', input).then((r) => r.data.data as Contact),
  update: (id: string, input: Partial<CreateContactInput>) =>
    api.patch(`/contacts/${id}`, input).then((r) => r.data.data as Contact),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  exportCsv: () =>
    api.get('/contacts/export', { responseType: 'blob' }).then((r) => r.data as Blob),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ data: { imported: number; skipped: number; errors: string[] } }>(
      '/contacts/import', form, { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data.data);
  },
  /** Importa em blocos de 500 (limite do backend); `onProgress` recebe quantos já foram enviados */
  importBulk: async (contacts: BulkContact[], onProgress?: (sent: number) => void) => {
    const total = { imported: 0, skipped: 0, errors: [] as string[] };
    for (let i = 0; i < contacts.length; i += 500) {
      const chunk = contacts.slice(i, i + 500);
      const { data } = await api.post<{ data: { imported: number; skipped: number; errors: string[] } }>(
        '/contacts/import-bulk', { contacts: chunk },
      );
      total.imported += data.data.imported;
      total.skipped += data.data.skipped;
      total.errors.push(...data.data.errors);
      onProgress?.(i + chunk.length);
      // Plano free bateu o limite: os próximos blocos falhariam igual
      if (data.data.errors.length) break;
    }
    return total;
  },
  uploadPhoto: async (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(`${import.meta.env.VITE_API_URL}/contacts/${id}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error('Upload failed'), { response: { status: res.status, data: body } });
    }
    return res.json();
  },
  deletePhoto: (id: string) => api.delete(`/contacts/${id}/photo`),
  photoUrl: (id: string) => `${import.meta.env.VITE_API_URL}/contacts/${id}/photo`,
};
