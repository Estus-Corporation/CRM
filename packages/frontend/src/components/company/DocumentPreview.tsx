import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Largura de uma página A4 renderizada pelo docx-preview (96 dpi) */
const DOCX_PAGE_WIDTH = 794;

/**
 * Primeira página do documento como uma "folha" em miniatura.
 * PDF: pdf.js desenha a página 1 num canvas. DOCX: docx-preview gera o HTML e a folha é
 * reduzida com transform. As duas libs só carregam quando a prévia aparece.
 */
export function DocumentPreview({
  blob,
  kind,
  onPages,
  className,
}: {
  blob?: Blob;
  kind: 'pdf' | 'docx';
  onPages?: (pages: number) => void;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [scale, setScale] = useState(0.25);

  // Escala da folha DOCX acompanha a largura da moldura
  useEffect(() => {
    if (kind !== 'docx' || !frameRef.current) return;
    const el = frameRef.current;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / DOCX_PAGE_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, [kind]);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    setState('loading');

    (async () => {
      try {
        if (kind === 'pdf') {
          const pdfjs = await import('pdfjs-dist');
          const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
          pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
          if (cancelled) return;
          onPages?.(doc.numPages);
          const page = await doc.getPage(1);
          const base = page.getViewport({ scale: 1 });
          // Renderiza em ~640px de largura: nítido na miniatura e em telas de alta densidade
          const viewport = page.getViewport({ scale: 640 / base.width });
          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        } else {
          const { renderAsync } = await import('docx-preview');
          const target = docxRef.current;
          if (!target || cancelled) return;
          target.innerHTML = '';
          await renderAsync(blob, target, undefined, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false });
          if (cancelled) return;
          onPages?.(Math.max(1, target.querySelectorAll('section.docx').length));
        }
        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // onPages muda a cada render do pai; o que importa é o arquivo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, kind]);

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative aspect-[210/297] w-full overflow-hidden rounded-md bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7),0_2px_6px_rgba(0,0,0,0.25)] ring-1 ring-black/10',
        className,
      )}
    >
      {kind === 'pdf' ? (
        <canvas ref={canvasRef} className={cn('h-full w-full object-cover object-top', state !== 'ready' && 'invisible')} />
      ) : (
        <div
          className={cn('pointer-events-none absolute left-0 top-0 origin-top-left', state !== 'ready' && 'invisible')}
          style={{ width: DOCX_PAGE_WIDTH, transform: `scale(${scale})` }}
        >
          {/* docx-preview injeta os estilos e as páginas aqui */}
          <div ref={docxRef} className="docx-thumb" />
        </div>
      )}

      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col gap-2 p-[12%]">
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-1.5 animate-pulse rounded bg-neutral-100" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
          ))}
        </div>
      )}
      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
          <FileText size={36} strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
