/**
 * Prévia de link de produto (Wishlist → "Automático").
 *
 *   GET /api/link-preview?url=<página>   → { title, image, price, currency, site, url }
 *   GET /api/link-preview?image=<imagem> → a imagem (para o navegador comprimir e guardar sem esbarrar em CORS)
 *
 * Roda como função da Vercel (pasta /api) e, no dev, como middleware do Vite (vite.config.ts).
 * Arquivo único e sem dependências de propósito: a Vercel compila cada arquivo de /api sozinho.
 */

interface Req {
  url?: string;
}
interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string | Uint8Array): void;
}

export interface LinkPreview {
  url: string;
  site: string;
  title: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_HTML = 3_000_000;
const MAX_IMAGE = 8_000_000;

/** Só http(s) e nada de rede interna (localhost, IPs privados) */
function safeUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') ||
    h === '0.0.0.0' || h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)
  ) return null;
  return u;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();

/** "1.299,90" / "1299.90" / "R$ 50" / 1299.9 → número */
export function parsePrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  let t = v.replace(/[^\d.,]/g, '');
  if (!t) return null;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma >= 0) t = t.replace(/,/g, '');
  else if (lastComma < 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Todas as <meta> da página: property/name/itemprop → content (a primeira vence) */
function metaTags(html: string) {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    const key = attr('property') ?? attr('name') ?? attr('itemprop');
    const content = attr('content');
    if (!key || !content) continue;
    const k = (key[2] ?? key[3] ?? '').toLowerCase();
    if (k && !out.has(k)) out.set(k, decode(content[2] ?? content[3] ?? ''));
  }
  return out;
}

/** Produtos descritos em JSON-LD (padrão schema.org que quase toda loja usa) */
function jsonLdProducts(html: string): Record<string, any>[] {
  const found: Record<string, any>[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const type = node['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) found.push(node);
    if (node['@graph']) visit(node['@graph']);
    if (node.mainEntity) visit(node.mainEntity);
  };
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      /* JSON-LD quebrado: ignora */
    }
  }
  return found;
}

function offerPrice(offers: any): { price: number | null; currency: string | null } {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const o of list) {
    const price = parsePrice(o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price);
    if (price) return { price, currency: o?.priceCurrency ?? o?.priceSpecification?.priceCurrency ?? null };
  }
  return { price: null, currency: null };
}

const firstImage = (img: any): string | null =>
  typeof img === 'string' ? img : Array.isArray(img) ? firstImage(img[0]) : img?.url ?? img?.contentUrl ?? null;

/** Tira o nome da loja do fim do título ("Tênis X | Mercado Livre" → "Tênis X") */
function cleanTitle(t: string | null, site: string) {
  if (!t) return null;
  const parts = t.split(/\s+[|–—-]\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    const host = site.replace(/^www\./, '').split('.')[0];
    if (last.length <= 30 && (last.includes(host) || /loja|store|shop|oficial|amazon|mercado/.test(last))) parts.pop();
  }
  return parts.join(' - ').slice(0, 140) || null;
}

export function extractPreview(html: string, pageUrl: URL): LinkPreview {
  const meta = metaTags(html);
  const product = jsonLdProducts(html)[0];
  const site = pageUrl.hostname.replace(/^www\./, '');
  const abs = (src: string | null | undefined) => {
    if (!src) return null;
    try {
      return new URL(decode(src), pageUrl).href;
    } catch {
      return null;
    }
  };

  const title =
    (typeof product?.name === 'string' && decode(product.name)) ||
    meta.get('og:title') || meta.get('twitter:title') ||
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || null;

  const image = abs(
    meta.get('og:image') || meta.get('og:image:secure_url') || meta.get('twitter:image') || firstImage(product?.image) ||
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    // Amazon: imagem principal
    html.match(/"hiRes":"(https:[^"]+)"/)?.[1] || html.match(/id="landingImage"[^>]+src="([^"]+)"/)?.[1],
  );

  let { price, currency } = offerPrice(product?.offers);
  if (!price) {
    price = parsePrice(meta.get('product:price:amount') ?? meta.get('og:price:amount') ?? meta.get('price') ?? meta.get('twitter:data1'));
    currency = meta.get('product:price:currency') ?? meta.get('og:price:currency') ?? meta.get('pricecurrency') ?? null;
  }
  if (!price) {
    // Fallbacks de lojas conhecidas
    const m =
      html.match(/class="a-offscreen">\s*([^<]+)</) || // Amazon
      html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/"price"\s*:\s*"?(\d+(?:[.,]\d+)?)"?/);
    price = parsePrice(m?.[1]);
  }

  return { url: pageUrl.href, site, title: cleanTitle(title, site), image, price, currency: currency ?? (price ? 'BRL' : null) };
}

async function readLimited(res: Response, limit: number) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer()).slice(0, limit);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => undefined);
  const out = new Uint8Array(Math.min(size, limit));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, out.length - o));
    out.set(part, o);
    o += part.length;
  }
  return out;
}

/** fetch seguindo redirecionamentos na mão, conferindo cada destino (nada de cair na rede interna) */
async function fetchSafe(start: URL, init: RequestInit): Promise<{ res: Response; url: URL } | null> {
  let url = start;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(url, { ...init, redirect: 'manual' });
    const loc = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !loc) return { res, url };
    const next = safeUrl(new URL(loc, url).href);
    if (!next) return null;
    url = next;
  }
  return null;
}

const send = (res: Res, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

export default async function handler(req: Req, res: Res) {
  const params = new URL(req.url ?? '/', 'http://localhost').searchParams;

  // Imagem: devolve os bytes (só imagens, até 8 MB)
  if (params.has('image')) {
    const target = safeUrl(params.get('image'));
    if (!target) return send(res, 400, { error: 'invalid_url' });
    try {
      const got = await fetchSafe(target, { headers: { 'User-Agent': UA, Referer: target.origin }, signal: AbortSignal.timeout(9000) });
      if (!got) return send(res, 400, { error: 'invalid_url' });
      const r = got.res;
      const type = r.headers.get('content-type') ?? '';
      if (!r.ok || !type.startsWith('image/')) return send(res, 502, { error: 'not_an_image' });
      const bytes = await readLimited(r, MAX_IMAGE);
      res.statusCode = 200;
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(bytes);
    } catch {
      return send(res, 502, { error: 'fetch_failed' });
    }
  }

  const target = safeUrl(params.get('url'));
  if (!target) return send(res, 400, { error: 'invalid_url' });
  try {
    const got = await fetchSafe(target, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!got) return send(res, 400, { error: 'invalid_url' });
    const r = got.res;
    if (!r.ok) return send(res, 502, { error: 'page_status', status: r.status });
    const html = new TextDecoder('utf-8').decode(await readLimited(r, MAX_HTML));
    // Loja mandou para captcha/verificação: não deu para ler a página
    if (/captcha|account-verification|challenge|validatecaptcha/i.test(got.url.pathname + got.url.search)) return send(res, 422, { error: 'blocked' });
    const preview = extractPreview(html, got.url);
    if (!preview.price && !preview.image && (!preview.title || preview.title.length < 20)) return send(res, 422, { error: 'blocked' });
    res.setHeader('Cache-Control', 'public, max-age=600');
    // O link guardado é o que a pessoa colou (não o destino de redirecionamentos)
    return send(res, 200, { ...preview, url: target.href });
  } catch {
    return send(res, 502, { error: 'fetch_failed' });
  }
}
