import { useEffect, useRef, useState } from 'react';
import { Minus, Move, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const VIEW = 280; // área de enquadramento na tela (px)
const OUTPUT = 256; // tamanho final do logo (px)
const MAX_ZOOM = 4;

interface Props {
  file: File | null;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
  title?: string;
  /** Prévia redonda (foto de perfil); o arquivo final continua quadrado */
  round?: boolean;
}

/**
 * Enquadra uma imagem (logo da empresa, foto de perfil): zoom (slider, botões ou roda do mouse) e arrastar pra posicionar.
 * Começa mostrando a imagem inteira; o que fica dentro do quadrado vira o logo.
 */
export function ImageCropModal({ file, onClose, onConfirm, title = 'Ajustar imagem', round = false }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Carrega a imagem escolhida
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // zoom 1 = imagem inteira visível ("contain"); acima disso, aproxima
  const base = img ? Math.min(VIEW / img.width, VIEW / img.height) : 1;
  const w = img ? img.width * base * zoom : 0;
  const h = img ? img.height * base * zoom : 0;

  // Não deixa arrastar a imagem pra fora: se ela é maior que o quadrado, a borda não aparece
  const clamp = (x: number, y: number, ww = w, hh = h) => ({
    x: ww > VIEW ? Math.max(-(ww - VIEW) / 2, Math.min((ww - VIEW) / 2, x)) : 0,
    y: hh > VIEW ? Math.max(-(hh - VIEW) / 2, Math.min((hh - VIEW) / 2, y)) : 0,
  });

  const changeZoom = (next: number) => {
    const z = Math.max(1, Math.min(MAX_ZOOM, next));
    if (!img) return setZoom(z);
    // Mantém o mesmo ponto no centro ao aproximar/afastar
    const ratio = z / zoom;
    setZoom(z);
    setOffset(clamp(offset.x * ratio, offset.y * ratio, img.width * base * z, img.height * base * z));
  };

  const confirm = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const k = OUTPUT / VIEW;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, ((VIEW - w) / 2 + offset.x) * k, ((VIEW - h) / 2 + offset.y) * k, w * k, h * k);
    const webp = canvas.toDataURL('image/webp', 0.9);
    // Navegador sem encoder WebP devolve PNG — também aceito pelo backend
    onConfirm(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
  };

  return (
    <Modal open={!!file} onClose={onClose} title={title} description="Arraste para posicionar e use o zoom para enquadrar." className="max-w-sm">
      <div className="space-y-4">
        <div
          className={cn(
            'relative mx-auto cursor-grab touch-none select-none overflow-hidden bg-white active:cursor-grabbing',
            round ? 'rounded-full' : 'rounded-2xl',
          )}
          style={{
            width: VIEW,
            height: VIEW,
            // Xadrez: mostra o que é transparente na imagem
            backgroundImage:
              'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset(clamp(drag.current.ox + e.clientX - drag.current.x, drag.current.oy + e.clientY - drag.current.y));
          }}
          onPointerUp={() => (drag.current = null)}
          onWheel={(e) => changeZoom(zoom - e.deltaY * 0.0015)}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ width: w, height: h, left: (VIEW - w) / 2 + offset.x, top: (VIEW - h) / 2 + offset.y }}
            />
          )}
          {w > VIEW || h > VIEW ? (
            <span className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
              <Move size={11} /> arraste
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => changeZoom(zoom - 0.25)}
            aria-label="Diminuir zoom"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
          >
            <Minus size={15} />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 flex-1 cursor-pointer accent-[rgb(var(--accent-green))]"
          />
          <button
            type="button"
            onClick={() => changeZoom(zoom + 0.25)}
            aria-label="Aumentar zoom"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
          >
            <Plus size={15} />
          </button>
          <span className="w-11 text-right text-xs tabular-nums text-text-muted">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={!img}>
            Usar imagem
          </Button>
        </div>
      </div>
    </Modal>
  );
}
