import { compressImage } from './idb';

/** Resposta de /api/link-preview (função em packages/frontend/api/link-preview.ts) */
export interface LinkPreview {
  url: string;
  site: string;
  title: string | null;
  image: string | null;
  /** Mesma foto em resoluções maiores, melhor primeiro */
  images?: string[];
  price: number | null;
  currency: string | null;
}

export type PreviewError = 'invalid_url' | 'blocked' | 'unreachable';

const ENDPOINT = '/api/link-preview';
/** Fotos da Wishlist: maiores e com menos compressão que as do resto do app */
const WISH_MAX = 1400;
const WISH_QUALITY = 0.92;

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

/** Baixa uma imagem pelo servidor (sem CORS) */
async function proxied(src: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${ENDPOINT}?image=${encodeURIComponent(src)}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith('image/') ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Guarda a melhor foto possível: tenta as versões grandes em ordem e comprime em alta.
 * Se nenhuma vier pelo servidor, fica o link da original.
 */
export async function importImage(candidates: string[]): Promise<string | null> {
  for (const src of candidates) {
    const blob = await proxied(src);
    if (!blob) continue;
    try {
      return await compressImage(blob, WISH_MAX, WISH_QUALITY);
    } catch {
      /* formato que o navegador não abre: tenta a próxima */
    }
  }
  return candidates[candidates.length - 1] ?? null;
}

/** Foto enviada/colada na Wishlist: mesma qualidade alta */
export const compressWishImage = (file: Blob) => compressImage(file, WISH_MAX, WISH_QUALITY);

// ── Tirar fundo ─────────────────────────────────────────────────────────────

/**
 * Recorte feito no próprio navegador (@imgly/background-removal): a foto não sai do computador.
 * A biblioteca vem do CDN só quando alguém pede, e o modelo (~40 MB) é baixado uma vez e fica no cache.
 */
const BG_LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
/** isnet_fp16: mesma qualidade do modelo completo nos testes, com metade do download */
const BG_MODEL = 'isnet_fp16';
type RemoveBg = (img: Blob, config?: Record<string, unknown>) => Promise<Blob>;
let libPromise: Promise<{ removeBackground: RemoveBg }> | null = null;

export type BgStage = 'download' | 'process';

async function toBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return (await fetch(src)).blob();
  const blob = await proxied(src);
  if (!blob) throw new Error('image_unavailable');
  return blob;
}

/** Abaixo disso é fundo; a partir de ALPHA_CUT + ALPHA_SOLID é totalmente sólido (borda suave no meio) */
const ALPHA_CUT = 0.03;
const ALPHA_SOLID = 0.55;

/** Corta as bordas transparentes (o produto ocupa o quadro) e comprime mantendo a transparência */
async function trimTransparent(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const src = document.createElement('canvas');
  src.width = bmp.width;
  src.height = bmp.height;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = sctx.getImageData(0, 0, src.width, src.height);
  const { data, width, height } = img;
  // Firma a transparência: o modelo deixa meio transparentes as partes claras do produto
  // (ex.: lateral de caixa clareando para o branco). Quase-zero vira fundo, o resto sobe rápido para sólido.
  for (let k = 3; k < data.length; k += 4) {
    const a = data[k] / 255;
    data[k] = a < ALPHA_CUT ? 0 : Math.round(Math.min(1, (a - ALPHA_CUT) / ALPHA_SOLID) * 255);
  }
  sctx.putImageData(img, 0, 0);
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error('empty_cutout');
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.04);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const w = right - left + 1;
  const h = bottom - top + 1;
  const scale = Math.min(1, WISH_MAX / Math.max(w, h));
  const out = document.createElement('canvas');
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  out.getContext('2d')!.drawImage(src, left, top, w, h, 0, 0, out.width, out.height);
  return out.toDataURL('image/webp', WISH_QUALITY);
}

export async function removeImageBackground(src: string, onStage?: (stage: BgStage, pct: number | null) => void): Promise<string> {
  onStage?.('download', null);
  libPromise ??= import(/* @vite-ignore */ BG_LIB) as Promise<{ removeBackground: RemoveBg }>;
  let lib: { removeBackground: RemoveBg };
  try {
    lib = await libPromise;
  } catch (e) {
    libPromise = null; // deixa tentar de novo depois
    throw e;
  }
  const input = await toBlob(src);
  const cut = await lib.removeBackground(input, {
    model: BG_MODEL,
    output: { format: 'image/png' },
    progress: (key: string, current: number, total: number) =>
      onStage?.(key.startsWith('fetch') ? 'download' : 'process', total ? Math.round((current / total) * 100) : null),
  });
  onStage?.('process', null);
  return trimTransparent(cut);
}

/** Parece um link? (para buscar sozinho ao colar) */
export const looksLikeUrl = (t: string) => /^https?:\/\/\S+\.\S+/i.test(t.trim());
