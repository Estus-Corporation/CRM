import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Download, ExternalLink, RefreshCw, Trash2, Upload } from 'lucide-react';
import { openOfferFile, useDeleteOfferFile, useOfferFileBlob, useUploadOfferFile, type Tenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { DocumentPreview } from './DocumentPreview';

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Nome sem extensão e com espaços no lugar de _ — lê melhor como título */
function prettyName(name: string) {
  return name.replace(/\.(pdf|docx)$/i, '').replace(/[_]+/g, ' ').trim();
}

/**
 * Cartão do arquivo de serviços e preços: prévia da primeira página (clicável) + nome,
 * tipo, tamanho, nº de páginas e ações. `children` = ações extras (trocar/remover no formulário).
 */
export function OfferFileCard({
  tenant,
  children,
  bare = false,
}: {
  tenant: Tenant;
  children?: ReactNode;
  /** Sem moldura própria: usa o fundo do card em volta (página "Sobre a empresa") */
  bare?: boolean;
}) {
  const pdf = tenant.offer_file_mime === 'application/pdf';
  const { data: blob } = useOfferFileBlob(tenant);
  const [pages, setPages] = useState<number | null>(null);
  const open = () => openOfferFile(tenant, blob);

  return (
    <div className={cn(!bare && 'overflow-hidden rounded-2xl border border-fg/[0.08] bg-bg-surface')}>
      <div className="grid sm:grid-cols-[200px_minmax(0,1fr)]">
        {/* Folha em miniatura sobre um fundo levemente iluminado */}
        <button
          type="button"
          onClick={open}
          title={pdf ? 'Abrir PDF' : 'Baixar documento'}
          className={cn(
            'group relative flex items-start justify-center overflow-hidden bg-gradient-to-br from-accent-green/[0.10] via-fg/[0.03] to-transparent px-3 pt-3 max-sm:h-56 sm:p-3',
            bare && 'rounded-xl',
          )}
        >
          <DocumentPreview
            blob={blob}
            kind={pdf ? 'pdf' : 'docx'}
            onPages={setPages}
            className="transition-transform duration-300 max-sm:w-[92%] group-hover:-translate-y-1 group-hover:rotate-[-1deg]"
          />
          {/* Celular: a folha é cortada embaixo com um esmaecido */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg-primary/90 to-transparent sm:hidden" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              {pdf ? <ExternalLink size={13} /> : <Download size={13} />}
              {pdf ? 'Abrir' : 'Baixar'}
            </span>
          </span>
        </button>

        <div
          className={cn(
            'flex min-w-0 flex-col justify-between gap-4',
            bare ? 'pt-4 sm:pl-5 sm:pt-0' : 'border-fg/[0.06] p-4 max-sm:border-t sm:border-l sm:p-5',
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]">
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5',
                  pdf ? 'bg-status-lost/15 text-status-lost' : 'bg-status-open/15 text-status-open',
                )}
              >
                {pdf ? 'PDF' : 'DOCX'}
              </span>
              <span className="text-text-muted">{formatSize(tenant.offer_file_size)}</span>
              {pages && (
                <span className="text-text-muted">
                  · {pages} {pages === 1 ? 'página' : 'páginas'}
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 break-words text-[15px] font-semibold leading-snug text-text-primary" title={tenant.offer_file_name ?? ''}>
              {prettyName(tenant.offer_file_name ?? '')}
            </p>
            <p className="mt-1.5 text-sm text-text-secondary">Planos, preços e condições para usar na ligação.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={open} className="max-sm:flex-1">
              {pdf ? <ExternalLink size={14} /> : <Download size={14} />}
              {pdf ? 'Abrir documento' : 'Baixar documento'}
            </Button>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Campo do formulário: "Serviços e preços" só por arquivo (PDF ou DOCX), enviado na hora */
export function OfferFileField({ tenant }: { tenant?: Tenant }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const upload = useUploadOfferFile();
  const remove = useDeleteOfferFile();

  const send = (file: File) => {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      toast.error('Envie um arquivo PDF ou DOCX');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo maior que 10 MB');
      return;
    }
    upload.mutate(file, { onSuccess: () => toast.success('Arquivo de serviços e preços salvo') });
  };

  const pick = () => inputRef.current?.click();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">Serviços e preços</span>

      {tenant?.offer_file_name ? (
        <OfferFileCard tenant={tenant}>
          <Button type="button" variant="secondary" size="sm" onClick={pick} disabled={upload.isPending} title="Trocar arquivo">
            <RefreshCw size={14} className={cn(upload.isPending && 'animate-spin')} />
            Trocar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success('Arquivo removido') })}
            disabled={remove.isPending}
            aria-label="Remover arquivo"
            title="Remover arquivo"
            className="hover:text-status-lost"
          >
            <Trash2 size={14} />
          </Button>
        </OfferFileCard>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={upload.isPending}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) send(file);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors',
            dragging
              ? 'border-accent-green/60 bg-accent-green/[0.06]'
              : 'border-fg/[0.16] hover:border-accent-green/50 hover:bg-accent-green/[0.04]',
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-green/10 text-accent-green">
            <Upload size={19} className={cn(upload.isPending && 'animate-pulse')} />
          </span>
          <span className="text-sm font-medium text-text-primary">{upload.isPending ? 'Enviando…' : 'Enviar PDF ou DOCX'}</span>
          <span className="text-xs text-text-muted">Clique ou arraste o arquivo aqui · até 10 MB</span>
        </button>
      )}

      <p className="text-xs text-text-muted">O que o cliente compra e quanto custa. O captador abre o arquivo em "Sobre a empresa".</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) send(file);
        }}
      />
    </div>
  );
}
