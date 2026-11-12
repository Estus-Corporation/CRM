import { useRef, useState, type ClipboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Eraser, ImageIcon, CheckCircle2, ExternalLink, Gift, ImagePlus, Link2, Loader2, Plus, RotateCcw, ShoppingBag, Trash2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';
import { type WishCategory, type WishItem, WISH_CATEGORIES, brl, parseMoney, wishCategoryOf } from '../data';
import { type BgStage, type PreviewError, compressWishImage, fetchLinkPreview, importImage, looksLikeUrl, removeImageBackground } from '../linkPreview';
import { type WishInput, useRpg } from '../store';
import { ItemImage, PageTitle } from '../ui';

type Filter = WishCategory | 'all';
type Show = 'pending' | 'bought';

const totalOf = (list: WishItem[]) => list.reduce((n, w) => n + (w.price ?? 0), 0);

export function Wishlist() {
  const wishlist = useRpg((s) => s.wishlist);
  const [params, setParams] = useSearchParams();
  const filter = (WISH_CATEGORIES.some((c) => c.key === params.get('cat')) ? params.get('cat') : 'all') as Filter;
  const [show, setShow] = useState<Show>('pending');
  const [modal, setModal] = useState<{ open: boolean; editing: WishItem | null }>({ open: false, editing: null });

  const pending = wishlist.filter((w) => !w.boughtAt);
  const inFilter = (w: WishItem) => filter === 'all' || w.category === filter;
  const list = wishlist
    .filter((w) => inFilter(w) && (show === 'pending' ? !w.boughtAt : !!w.boughtAt))
    .sort((a, b) => (show === 'bought' ? b.boughtAt!.localeCompare(a.boughtAt!) : b.createdAt.localeCompare(a.createdAt)));
  const setFilter = (f: Filter) => setParams(f === 'all' ? {} : { cat: f }, { replace: true });
  const open = (editing: WishItem | null = null) => setModal({ open: true, editing });

  return (
    <div className="space-y-5">
      <PageTitle
        title="Wishlist"
        subtitle={pending.length ? `${pending.length} ${pending.length === 1 ? 'desejo' : 'desejos'} · ${brl(totalOf(pending))} no total` : 'O que você quer ter, separado por categoria.'}
        actions={<Button onClick={() => open()}><Plus size={16} /> Adicionar</Button>}
      />

      {/* Categorias */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {[{ key: 'all' as const, label: 'Todas', icon: Gift }, ...WISH_CATEGORIES].map((c) => {
          const items = pending.filter((w) => c.key === 'all' || w.category === c.key);
          const active = filter === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setFilter(c.key)}
              className={cn('flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors',
                active ? 'border-fg/[0.22] bg-fg/[0.09]' : 'border-fg/[0.08] bg-fg/[0.03] hover:bg-fg/[0.06]')}>
              <c.icon size={19} strokeWidth={1.8} className={active ? 'text-text-primary' : 'text-text-secondary'} />
              <span className="w-full">
                <span className={cn('block truncate text-[13px] font-semibold', active ? 'text-text-primary' : 'text-text-secondary')}>{c.label}</span>
                <span className="block text-[11px] tabular-nums text-text-muted">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}{totalOf(items) ? ` · ${brl(totalOf(items))}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-[20px] border border-fg/[0.08] bg-bg-surface/70 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15.5px] font-semibold text-text-primary">{filter === 'all' ? 'Todas as categorias' : wishCategoryOf(filter).label}</h2>
          <SegmentedControl
            layoutId="wish-show"
            value={show}
            onChange={setShow}
            className="ml-auto max-sm:w-full max-sm:[&>button]:flex-1"
            options={[
              { value: 'pending', label: `Quero ${wishlist.filter((w) => inFilter(w) && !w.boughtAt).length || ''}`.trim() },
              { value: 'bought', label: `Comprados ${wishlist.filter((w) => inFilter(w) && w.boughtAt).length || ''}`.trim() },
            ]}
          />
        </div>

        <div className="mt-5">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-fg/[0.12] py-12 text-center">
              <p className="mx-auto max-w-xs text-sm text-text-secondary">
                {show === 'pending' ? 'Nada na lista aqui ainda. Adicione o que você quer comprar, com foto e preço.' : 'O que você comprar da lista aparece aqui.'}
              </p>
              {show === 'pending' && <Button variant="secondary" size="sm" className="mt-4" onClick={() => open()}><Plus size={14} /> Adicionar desejo</Button>}
            </div>
          ) : (
            <motion.ul layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <AnimatePresence initial={false}>
                {list.map((w) => <WishCard key={w.id} item={w} onOpen={() => open(w)} />)}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </section>

      <WishModal open={modal.open} editing={modal.editing} defaultCategory={filter === 'all' ? 'lifestyle' : filter} onClose={() => setModal({ open: false, editing: null })} />
    </div>
  );
}

function WishCard({ item, onOpen }: { item: WishItem; onOpen: () => void }) {
  const { buyWish, unbuyWish } = useRpg();
  const c = wishCategoryOf(item.category);
  const buy = () => {
    buyWish(item.id);
    toast.success(item.price ? `Comprado: ${item.name} · lançado nos gastos` : `Comprado: ${item.name}`, {
      action: { label: 'Desfazer', onClick: () => unbuyWish(item.id) },
    });
  };
  return (
    <motion.li layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="min-w-0">
      <button type="button" onClick={onOpen} className="group block w-full text-left">
        <div className="relative">
          <ItemImage src={item.image} icon={c.icon} dim={!!item.boughtAt} contain={!!item.imageOriginal}
            className="aspect-square w-full rounded-2xl border border-fg/[0.08] transition-transform duration-300 group-hover:scale-[1.02]" />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
            <c.icon size={11} /> {c.label}
          </span>
        </div>
        <p className="mt-2 truncate text-[13.5px] font-medium text-text-primary">{item.name}</p>
        <p className="text-xs tabular-nums text-text-muted">{item.price != null ? brl(item.price) : 'Sem preço'}</p>
      </button>
      {item.boughtAt ? (
        <button type="button" onClick={() => unbuyWish(item.id)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-fg/[0.1] py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-fg/[0.05]">
          <RotateCcw size={13} /> Voltar para a lista
        </button>
      ) : (
        <button type="button" onClick={buy}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent-green/15 py-1.5 text-xs font-semibold text-accent-green transition-colors hover:bg-accent-green/25">
          <ShoppingBag size={13} /> Comprei
        </button>
      )}
    </motion.li>
  );
}

interface Draft { category: WishCategory; name: string; image: string | null; imageOriginal: string | null; price: string; link: string; note: string }

function WishModal({ open, editing, defaultCategory, onClose }: { open: boolean; editing: WishItem | null; defaultCategory: WishCategory; onClose: () => void }) {
  const { addWish, updateWish, removeWish } = useRpg();
  const [d, setD] = useState<Draft>({ category: defaultCategory, name: '', image: null, imageOriginal: null, price: '', link: '', note: '' });
  const [urlMode, setUrlMode] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Automático = colar o link e puxar título, foto e preço da página
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [autoUrl, setAutoUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // Tirar fundo: etapa em andamento (baixando o modelo na 1ª vez / recortando)
  const [bg, setBg] = useState<{ stage: BgStage; pct: number | null } | null>(null);
  const [bgError, setBgError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? editing?.id ?? `new-${defaultCategory}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setD(editing
        ? { category: editing.category, name: editing.name, image: editing.image, imageOriginal: editing.imageOriginal ?? null, price: editing.price != null ? String(editing.price).replace('.', ',') : '', link: editing.link, note: editing.note }
        : { category: defaultCategory, name: '', image: null, imageOriginal: null, price: '', link: '', note: '' });
      setUrlMode(false);
      setConfirm(false);
      setMode(editing ? 'manual' : 'auto');
      setAutoUrl('');
      setFetching(false);
      setNotice(null);
      setBg(null);
      setBgError(false);
    }
  }

  const ERROR_TEXT: Record<PreviewError, string> = {
    invalid_url: 'Esse link não parece válido. Confira e tente de novo.',
    blocked: 'Essa loja não deixa ler a página automaticamente. O link ficou salvo: complete o resto à mão.',
    unreachable: 'Não consegui abrir a página agora. O link ficou salvo: complete o resto à mão.',
  };

  const runAuto = async (raw: string) => {
    const url = raw.trim();
    if (!looksLikeUrl(url) || fetching) {
      if (url && !looksLikeUrl(url)) setNotice({ ok: false, text: ERROR_TEXT.invalid_url });
      return;
    }
    setFetching(true);
    setNotice(null);
    const result = await fetchLinkPreview(url);
    if ('error' in result) {
      setFetching(false);
      if (result.error === 'invalid_url') return setNotice({ ok: false, text: ERROR_TEXT.invalid_url });
      setD((x) => ({ ...x, link: url }));
      setNotice({ ok: false, text: ERROR_TEXT[result.error] });
      setMode('manual');
      return;
    }
    const p = result.data;
    const image = p.images?.length || p.image ? await importImage(p.images?.length ? p.images : [p.image!]) : null;
    setD((x) => ({
      ...x,
      link: url,
      name: p.title ?? x.name,
      price: p.price != null ? String(p.price).replace('.', ',') : x.price,
      image: image ?? x.image,
      imageOriginal: image ? null : x.imageOriginal,
    }));
    const missing = [!p.title && 'nome', !p.price && 'preço', !p.image && 'foto'].filter(Boolean);
    setNotice({
      ok: true,
      text: `Encontrado em ${p.site}.${missing.length ? ` Faltou: ${missing.join(', ')}.` : ''} Confira e escolha a categoria.`,
    });
    setFetching(false);
    setMode('manual');
  };

  const takeFile = async (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setLoadingImg(true);
    try {
      const image = await compressWishImage(file);
      setD((x) => ({ ...x, image, imageOriginal: null }));
    } finally {
      setLoadingImg(false);
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      e.preventDefault();
      void takeFile(file);
    }
  };

  /** Sem fundo: recorta no navegador e guarda a original para poder voltar. Com fundo: volta à original. */
  const toggleBackground = async (cut: boolean) => {
    setBgError(false);
    if (!d.image || cut === !!d.imageOriginal) return;
    if (!cut) return setD((x) => ({ ...x, image: x.imageOriginal, imageOriginal: null }));
    const original = d.image;
    setBg({ stage: 'download', pct: null });
    try {
      const cutout = await removeImageBackground(original, (stage, pct) => setBg({ stage, pct }));
      setD((x) => (x.image === original ? { ...x, image: cutout, imageOriginal: original } : x));
    } catch {
      setBgError(true);
    } finally {
      setBg(null);
    }
  };

  const save = () => {
    if (!d.name.trim()) return;
    const input: WishInput = { ...d, price: parseMoney(d.price), link: d.link.trim(), note: d.note.trim() };
    if (editing) updateWish(editing.id, input);
    else addWish(input);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar desejo' : 'Novo desejo'} className="max-w-lg">
      <div className="space-y-4" onPaste={mode === 'manual' ? onPaste : undefined}>
        {!editing && (
          <SegmentedControl
            layoutId="wish-mode"
            value={mode}
            onChange={(m) => { setMode(m); setNotice(null); }}
            className="w-full [&>button]:flex-1"
            options={[{ value: 'auto', label: 'Automático' }, { value: 'manual', label: 'Manual' }]}
          />
        )}

        {mode === 'auto' ? (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] p-3.5 text-sm text-text-secondary">
              <Wand2 size={18} className="mt-0.5 flex-shrink-0 text-accent-green" />
              <p>Cole o link da página onde você achou o produto. Eu puxo o nome, a foto e o preço, e você só confere.</p>
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={autoUrl}
                onChange={(e) => setAutoUrl(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (looksLikeUrl(text)) {
                    e.preventDefault();
                    setAutoUrl(text.trim());
                    void runAuto(text);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && void runAuto(autoUrl)}
                disabled={fetching}
                placeholder="https://loja.com.br/produto…"
                className="input-base h-11 w-full text-sm"
              />
              <Button onClick={() => void runAuto(autoUrl)} disabled={fetching || !autoUrl.trim()} className="h-11 flex-shrink-0">
                {fetching ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
              </Button>
            </div>
            {fetching && <p className="text-xs text-text-muted">Lendo a página…</p>}
            {notice && !notice.ok && <p className="flex items-start gap-1.5 text-xs text-accent-amber"><AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {notice.text}</p>}
            <div className="flex justify-end border-t border-fg/[0.06] pt-4">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            </div>
          </div>
        ) : (
        <>
        {notice && (
          <p className={cn('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs',
            notice.ok ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber')}>
            {notice.ok ? <CheckCircle2 size={14} className="mt-px flex-shrink-0" /> : <AlertTriangle size={14} className="mt-px flex-shrink-0" />}
            {notice.text}
          </p>
        )}
        <div className="flex gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void takeFile(e.dataTransfer.files[0]); }}
            className="relative flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-fg/[0.18] bg-fg/[0.03] text-text-muted transition-colors hover:border-fg/[0.3] hover:text-text-primary">
            {d.image ? (
              <img src={d.image} alt="" className={cn('h-full w-full', d.imageOriginal ? 'object-contain p-2 drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]' : 'object-cover')} />
            ) : <ImagePlus size={24} />}
            {(loadingImg || bg) && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 px-2 text-center text-[11px] leading-tight text-white">
                <Loader2 size={16} className="animate-spin" />
                {bg ? (bg.stage === 'download' ? `Preparando${bg.pct != null ? ` ${bg.pct}%` : '…'}` : 'Recortando…') : 'Carregando…'}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 text-xs text-text-muted">
            <p>Clique para enviar, arraste ou cole uma imagem (Ctrl+V).</p>
            {urlMode ? (
              <input autoFocus placeholder="https://…" defaultValue={d.image?.startsWith('http') ? d.image : ''}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== d.image) setD({ ...d, image: v, imageOriginal: null }); }} className="input-base h-9 w-full text-xs" />
            ) : (
              <button type="button" onClick={() => setUrlMode(true)} className="flex w-fit items-center gap-1 text-text-secondary hover:text-text-primary">
                <Link2 size={13} /> Usar link da imagem
              </button>
            )}
            {d.image && (
              <button type="button" onClick={() => setD({ ...d, image: null, imageOriginal: null })} className="flex w-fit items-center gap-1 text-text-secondary hover:text-status-lost">
                <X size={13} /> Tirar foto
              </button>
            )}
          </div>
        </div>

        {d.image && (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { cut: false, label: 'Com fundo', icon: ImageIcon },
                { cut: true, label: 'Sem fundo', icon: Eraser },
              ].map((o) => {
                const active = !!d.imageOriginal === o.cut;
                return (
                  <button key={o.label} type="button" disabled={!!bg || loadingImg} onClick={() => void toggleBackground(o.cut)}
                    className={cn('flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60',
                      active ? 'border-accent-green/50 bg-accent-green/15 text-accent-green' : 'border-fg/[0.1] text-text-secondary hover:bg-fg/[0.05]')}>
                    <o.icon size={14} /> {o.label}
                  </button>
                );
              })}
            </div>
            {bg?.stage === 'download' && <p className="mt-1.5 text-[11px] text-text-muted">Na primeira vez o recorte baixa um modelo (~40 MB). Depois fica salvo no navegador.</p>}
            {bgError && <p className="mt-1.5 text-[11px] text-accent-amber">Não consegui tirar o fundo dessa foto. Tente de novo ou use outra imagem.</p>}
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome</label>
            <input autoFocus={!editing} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()}
              maxLength={80} placeholder="Ex.: Fone com cancelamento de ruído" className="input-base h-10 w-full text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Preço</label>
            <input inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} placeholder="R$ 0,00" className="input-base h-10 w-full text-sm tabular-nums" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Categoria</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {WISH_CATEGORIES.map((c) => (
              <button key={c.key} type="button" onClick={() => setD({ ...d, category: c.key })}
                className={cn('flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11.5px] font-medium transition-colors',
                  d.category === c.key ? 'border-accent-green/50 bg-accent-green/15 text-accent-green' : 'border-fg/[0.1] text-text-secondary hover:bg-fg/[0.05]')}>
                <c.icon size={14} className="flex-shrink-0" /> <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Link (opcional)</label>
          <div className="flex gap-2">
            <input value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} placeholder="Onde comprar" className="input-base h-10 w-full text-sm" />
            {/^https?:\/\//.test(d.link) && (
              <>
                <button type="button" onClick={() => void runAuto(d.link)} disabled={fetching} aria-label="Puxar dados do link" title="Puxar nome, foto e preço do link"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-fg/[0.1] text-text-secondary hover:text-text-primary disabled:opacity-50">
                  {fetching ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                </button>
                <a href={d.link} target="_blank" rel="noreferrer" aria-label="Abrir link" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-fg/[0.1] text-text-secondary hover:text-text-primary">
                  <ExternalLink size={15} />
                </a>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Anotação</label>
          <textarea value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} rows={2} maxLength={500} placeholder="Tamanho, cor, modelo…" className="input-base w-full resize-none py-2 text-sm" />
        </div>

        <div className="flex items-center gap-2 border-t border-fg/[0.06] pt-4">
          {editing && (confirm ? (
            <Button variant="danger" onClick={() => { removeWish(editing.id); onClose(); }}>Excluir desejo</Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirm(true)} aria-label="Excluir desejo"><Trash2 size={15} /></Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!d.name.trim() || loadingImg || fetching || !!bg}>{editing ? <><Check size={15} /> Salvar</> : 'Adicionar'}</Button>
          </div>
        </div>
        </>
        )}
      </div>
    </Modal>
  );
}
