import { compressImage } from './idb';

/** Resposta de /api/link-preview (função em packages/frontend/api/link-preview.ts) */
export interface LinkPreview {
  url: string;
  site: string;
  title: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
}

export type PreviewError = 'invalid_url' | 'blocked' | 'unreachable';

const ENDPOINT = '/api/link-preview';

/** Lê título, imagem e preço da página do produto */
export async function fetchLinkPreview(url: string): Promise<{ data: LinkPreview } | { error: PreviewError }> {
  try {
    const res = await fetch(`${ENDPOINT}?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => null);
    if (res.ok && body) return { data: body as LinkPreview };
    if (body?.error === 'invalid_url') return { error: 'invalid_url' };
    if (body?.error === 'blocked' || body?.error === 'page_status') return { error: 'blocked' };
    return { error: 'unreachable' };
  } catch {
    return { error: 'unreachable' };
  }
}

/** Baixa a imagem pelo servidor (sem CORS) e guarda comprimida; se não der, fica o link dela */
export async function importImage(src: string): Promise<string> {
  try {
    const res = await fetch(`${ENDPOINT}?image=${encodeURIComponent(src)}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return src;
    return await compressImage(await res.blob());
  } catch {
    return src;
  }
}

/** Parece um link? (para buscar sozinho ao colar) */
export const looksLikeUrl = (t: string) => /^https?:\/\/\S+\.\S+/i.test(t.trim());
