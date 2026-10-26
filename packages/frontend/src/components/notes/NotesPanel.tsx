import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, NotebookPen, X } from 'lucide-react';
import { notesService } from '@/services/notes.service';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

const NOTES_WIDTH = 360;
const SAVE_DELAY = 700;
const panelSpring = { type: 'spring', visualDuration: 0.45, bounce: 0 } as const;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Conteúdo do painel: textarea com salvamento automático (debounce) no backend */
function NotesEditor() {
  const setNotesOpen = useUIStore((s) => s.setNotesOpen);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notes', 'me'], queryFn: notesService.getMine });

  const [draft, setDraft] = useState('');
  const [state, setState] = useState<SaveState>('idle');
  const loaded = useRef(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [ready, setReady] = useState(false);

  // Carrega o texto salvo uma vez — depois disso o rascunho local manda
  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      setDraft(data.content);
      setReady(true);
    }
  }, [data]);

  // Só foca quando o texto chegou (autoFocus num campo ainda carregando deixava o foco no botão
  // "Notas", e a barra de espaço fechava o painel). Cursor no fim, pra continuar escrevendo.
  useEffect(() => {
    const el = textareaRef.current;
    if (!ready || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [ready]);

  const tenantAtMount = useRef(useAuthStore.getState().user?.tenant_id);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const content = pending.current;
    if (content === null) return;
    pending.current = null;
    // Trocou de workspace com texto pendente: o token já é do outro workspace — descarta
    if (useAuthStore.getState().user?.tenant_id !== tenantAtMount.current) return;
    setState('saving');
    try {
      const saved = await notesService.saveMine(content);
      qc.setQueryData(['notes', 'me'], saved);
      // Se chegou mais texto enquanto salvava, o próximo flush cuida
      setState(pending.current === null ? 'saved' : 'saving');
    } catch {
      setState('error');
    }
  }, [qc]);

  // Fecha o painel ou troca de tela: salva o que faltar
  useEffect(() => () => void flush(), [flush]);

  const onChange = (value: string) => {
    setDraft(value);
    pending.current = value;
    setState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-fg/[0.08] px-4">
        <NotebookPen size={16} className="text-accent-green" />
        <p className="text-sm font-semibold text-text-primary">Notas</p>
        <span className="ml-1 flex items-center gap-1 text-xs text-text-muted">
          {state === 'saving' && (
            <>
              <Loader2 size={12} className="animate-spin" /> Salvando…
            </>
          )}
          {state === 'saved' && (
            <>
              <Check size={12} className="text-accent-green" /> Salvo
            </>
          )}
          {state === 'error' && <span className="text-status-lost">Erro ao salvar</span>}
        </span>
        <button
          type="button"
          onClick={() => setNotesOpen(false)}
          aria-label="Fechar notas"
          title="Fechar notas"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void flush()}
        readOnly={!ready}
        maxLength={50000}
        spellCheck
        placeholder={!ready ? 'Carregando…' : 'Anote o que quiser — salva sozinho.\n\nSó você vê estas notas.'}
        className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
      />
    </div>
  );
}

/**
 * Painel de anotações à direita. Desktop: coluna que abre ao lado da pasta (a pasta encolhe).
 * Celular: ocupa a tela por cima do conteúdo.
 */
function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return matches;
}

export function NotesPanel() {
  const notesOpen = useUIStore((s) => s.notesOpen);
  const setNotesOpen = useUIStore((s) => s.setNotesOpen);
  // Um editor só por vez: dois montados teriam rascunhos separados salvando um por cima do outro
  const isDesktop = useIsDesktop();
  // Trocar de workspace recria o editor: o rascunho de um workspace nunca é salvo no outro
  const tenantId = useAuthStore((s) => s.user?.tenant_id);

  // Esc fecha
  useEffect(() => {
    if (!notesOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNotesOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notesOpen, setNotesOpen]);

  return (
    <>
      {/* Desktop: só a largura externa anima; o conteúdo tem largura fixa (não sofre relayout) */}
      <motion.aside
        className="relative z-10 hidden flex-shrink-0 overflow-hidden md:block"
        initial={false}
        animate={{ width: notesOpen ? NOTES_WIDTH : 0 }}
        transition={panelSpring}
        aria-hidden={!notesOpen}
      >
        {/* pt-[72px] = altura do cabeçalho (64px) + respiro do topo: alinha com o corpo da pasta */}
        <div className="h-full pr-3 pt-[72px]" style={{ width: NOTES_WIDTH }}>
          <div
            className="folder-surface h-full overflow-hidden rounded-t-[22px]"
            style={{ boxShadow: '0 24px 48px -24px rgba(0, 0, 0, 0.55)' }}
          >
            {notesOpen && isDesktop && <NotesEditor key={tenantId} />}
          </div>
        </div>
      </motion.aside>

      {/* Celular: tela cheia por cima */}
      <AnimatePresence>
        {notesOpen && !isDesktop && (
          <motion.div
            className="folder-surface fixed inset-0 z-[55] md:hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={panelSpring}
          >
            <NotesEditor key={tenantId} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
