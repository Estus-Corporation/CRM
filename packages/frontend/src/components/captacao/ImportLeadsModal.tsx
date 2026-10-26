import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { contactsService } from '@/services/contacts.service';
import { downloadLeadTemplate, parseLeadSpreadsheet, type ParsedSheet } from '@/lib/leadSpreadsheet';
import { cn } from '@/lib/utils';

const FIELD_LABEL: Record<string, string> = {
  fullName: 'Nome',
  phone: 'Telefone',
  email: 'E-mail',
  company: 'Empresa',
  jobTitle: 'Cargo',
  niche: 'Nicho',
  source: 'Origem',
  address: 'Endereço',
  mapsUrl: 'Google',
  instagram: 'Instagram',
  website: 'Site',
  googleRating: 'Avaliação',
  googleReviews: 'Nº de avaliações',
  leadContext: 'Contexto',
};

type Step = 'pick' | 'preview' | 'importing' | 'done';

/** Importa uma planilha de leads direto para a fila de distribuição (viram contatos do tipo lead) */
export function ImportLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [niche, setNiche] = useState('');
  const [context, setContext] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setStep('pick');
    setFileName('');
    setSheet(null);
    setNiche('');
    setContext('');
    setProgress(0);
    setResult(null);
  };

  const handleClose = () => {
    if (step === 'importing') return;
    onClose();
    setTimeout(reset, 250);
  };

  const readFile = async (file: File) => {
    if (!/\.(xlsx|xls|ods|csv|txt)$/i.test(file.name)) {
      toast.error('Use uma planilha .xlsx, .xls ou .csv');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo maior que 10 MB');
      return;
    }
    try {
      const parsed = await parseLeadSpreadsheet(file);
      if (parsed.leads.length === 0) {
        toast.error('Nenhum lead encontrado — confira se há uma coluna "Nome"');
        return;
      }
      setFileName(file.name);
      setSheet(parsed);
      setStep('preview');
    } catch {
      toast.error('Não foi possível ler o arquivo');
    }
  };

  const runImport = async () => {
    if (!sheet) return;
    setStep('importing');
    setProgress(0);
    try {
      const leads = sheet.leads.map((l) => ({
        ...l,
        niche: l.niche || niche.trim() || undefined,
        leadContext: l.leadContext || context.trim() || undefined,
        source: l.source || 'Planilha',
      }));
      const res = await contactsService.importBulk(leads, setProgress);
      setResult(res);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['captacao'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('A importação falhou no meio — os leads já enviados foram salvos');
      setStep('preview');
    }
  };

  const total = sheet?.leads.length ?? 0;
  const hasNicheColumn = sheet?.columns.some((c) => c.field === 'niche');
  const hasContextColumn = sheet?.columns.some((c) => c.field === 'leadContext');

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar leads"
      description="Os leads da planilha entram na fila de distribuição. Duplicados (mesmo telefone ou e-mail) são ignorados."
      className="max-w-xl"
    >
      {step === 'pick' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className={cn(
              'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              dragging ? 'border-accent-green bg-accent-green/5' : 'border-fg/[0.14] hover:border-fg/[0.25] hover:bg-fg/[0.02]',
            )}
          >
            <FileSpreadsheet size={28} className="text-accent-green" />
            <span className="text-sm font-medium text-text-primary">Clique ou arraste a planilha aqui</span>
            <span className="text-xs text-text-muted">Excel (.xlsx, .xls) ou CSV — a primeira linha deve ter os nomes das colunas</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) readFile(file);
            }}
          />
          <div className="flex items-center justify-between gap-3 rounded-lg bg-fg/[0.03] px-4 py-3 text-xs text-text-muted">
            <span>
              Colunas reconhecidas: <strong className="text-text-secondary">Nome</strong> (obrigatória), Telefone/WhatsApp,
              E-mail, Empresa, Cargo, Nicho, Origem, Contexto.
            </span>
            <Button variant="secondary" size="sm" onClick={downloadLeadTemplate} className="flex-shrink-0">
              <Download size={13} />
              Modelo
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && sheet && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-fg/[0.08] px-4 py-3">
            <FileSpreadsheet size={18} className="flex-shrink-0 text-accent-green" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{fileName}</p>
              <p className="text-xs text-text-muted">
                {total} lead{total !== 1 ? 's' : ''}
                {sheet.ignored > 0 && ` · ${sheet.ignored} linha${sheet.ignored !== 1 ? 's' : ''} sem nome ignorada${sheet.ignored !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button type="button" onClick={reset} className="text-xs text-text-muted transition-colors hover:text-text-primary">
              Trocar arquivo
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sheet.columns.map((c, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-md px-2 py-1 text-xs',
                  c.field ? 'bg-accent-green/10 text-accent-green' : 'bg-fg/[0.04] text-text-muted line-through',
                )}
                title={c.field ? `"${c.header}" → ${FIELD_LABEL[c.field]}` : `"${c.header}" não será importada`}
              >
                {c.header || '(vazia)'}
                {c.field && c.header !== FIELD_LABEL[c.field] && ` → ${FIELD_LABEL[c.field]}`}
              </span>
            ))}
          </div>

          {/* Prévia das primeiras linhas */}
          <div className="overflow-hidden rounded-lg border border-fg/[0.08]">
            <table className="w-full text-left text-xs">
              <thead className="bg-fg/[0.04] text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Telefone</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Empresa</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Nicho</th>
                </tr>
              </thead>
              <tbody>
                {sheet.leads.slice(0, 5).map((l, i) => (
                  <tr key={i} className="border-t border-fg/[0.06] text-text-secondary">
                    <td className="max-w-[160px] truncate px-3 py-2 text-text-primary">{l.fullName}</td>
                    <td className="px-3 py-2">{l.phone || '—'}</td>
                    <td className="hidden max-w-[140px] truncate px-3 py-2 sm:table-cell">{l.company || '—'}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">{l.niche || niche || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 5 && <p className="border-t border-fg/[0.06] px-3 py-2 text-xs text-text-muted">+ {total - 5} outros</p>}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              {hasNicheColumn ? 'Nicho para quem estiver sem (opcional)' : 'Nicho desta lista (opcional)'}
            </span>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              maxLength={255}
              placeholder="Ex.: Clínicas odontológicas"
              className="input-base h-10"
            />
            <span className="text-xs text-text-muted">Ajuda a distribuir por nicho depois.</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              {hasContextColumn ? 'Contexto para quem estiver sem (opcional)' : 'Contexto das empresas desta lista (opcional)'}
            </span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Ex.: Clínicas de médio porte, a maioria sem site e com agenda pelo WhatsApp…"
              className="input-base min-h-[72px] resize-y py-2 text-sm"
            />
            <span className="text-xs text-text-muted">Aparece no card do lead para o captador entender com quem está falando.</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={runImport}>
              <Upload size={14} />
              Importar {total} lead{total !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm text-text-primary">Importando leads…</p>
          <div className="h-2 overflow-hidden rounded-full bg-fg/[0.08]">
            <div
              className="h-full rounded-full bg-accent-green transition-[width] duration-300"
              style={{ width: `${Math.round((progress / Math.max(total, 1)) * 100)}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-text-muted">
            {progress} de {total}
          </p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-accent-green/10 px-4 py-4">
            <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-accent-green" />
            <div className="text-sm">
              <p className="font-medium text-text-primary">
                {result.imported} lead{result.imported !== 1 ? 's' : ''} importado{result.imported !== 1 ? 's' : ''}
              </p>
              {result.skipped > 0 && (
                <p className="mt-0.5 text-text-secondary">
                  {result.skipped} ignorado{result.skipped !== 1 ? 's' : ''} por já existir{result.skipped !== 1 ? 'em' : ''} (mesmo telefone ou e-mail)
                </p>
              )}
              {result.errors.map((e) => (
                <p key={e} className="mt-0.5 text-status-lost">
                  {e}
                </p>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleClose}>Distribuir agora</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
