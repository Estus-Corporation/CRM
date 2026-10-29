import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { useImportCampaign } from '@/hooks/useLeadHunter';
import type { CampaignInput, ImportInput, LeadHunterService } from '@/services/leadhunter.service';
import { SERVICE_OPTIONS } from './CampaignFields';

const MAX_FILE_BYTES = 1_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** CSV vai como texto; JSON precisa de `leads` e a seção `config` do arquivo prevalece sobre os campos da tela */
async function readImport(file: File, config: Partial<CampaignInput>): Promise<ImportInput> {
  if (file.size > MAX_FILE_BYTES) throw new Error('O arquivo deve ter até 1 MB.');
  const content = await file.text();
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return { config, csv: content };

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Arquivo JSON inválido. Para planilhas, salve como CSV.');
  }
  if (!isRecord(data) || !Array.isArray(data.leads)) throw new Error('Arquivo JSON inválido: use o modelo, com a lista "leads".');
  const fileConfig = isRecord(data.config) ? (data.config as Partial<CampaignInput>) : {};
  return { config: { ...config, ...fileConfig }, leads: data.leads as Record<string, unknown>[] };
}

function ImportForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [service, setService] = useState<LeadHunterService>('google');
  const [error, setError] = useState<string | null>(null);
  const importer = useImportCampaign();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) return setError('Selecione um arquivo CSV ou JSON.');
    let input: ImportInput;
    try {
      // Campo vazio não vai: o backend decide (ou recusa com a mensagem certa)
      input = await readImport(file, { ...(niche.trim() && { niche: niche.trim() }), ...(city.trim() && { city: city.trim() }), service });
    } catch (err) {
      return setError(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
    }
    // Erros do backend (linhas inválidas, limite de 100) saem em toast pelo hook
    importer.mutate(input, {
      onSuccess: ({ id }) => {
        toast.success('Arquivo importado.');
        onCreated(id);
        onClose();
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
      <p className="text-sm text-text-secondary">
        Selecione um arquivo CSV ou JSON com até 100 empresas. Nome e endereço são obrigatórios; dados ausentes ficam sem informação e nenhuma
        posição de busca é presumida.
      </p>
      <p className="text-sm text-text-secondary">
        Modelos:{' '}
        <a href="/leadhunter/example.csv" download className="text-accent-green hover:underline">
          CSV (Excel)
        </a>{' '}
        ·{' '}
        <a href="/leadhunter/example.json" download className="text-accent-green hover:underline">
          JSON
        </a>
        . Um CSV exportado pelo LeadHunter também pode ser importado.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="lh-import-niche" label="Nicho" maxLength={100} placeholder="Loja de moda feminina" value={niche} onChange={(e) => setNiche(e.target.value)} />
        <Input
          id="lh-import-city"
          label="Cidade e região"
          maxLength={100}
          placeholder="Sao Carlos,State of Sao Paulo,Brazil"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <SelectField
          id="lh-import-service"
          label="Serviço que você oferece"
          options={SERVICE_OPTIONS}
          value={service}
          onChange={(e) => setService(e.target.value as LeadHunterService)}
        />
      </div>
      <p className="text-xs text-text-muted">A cidade é usada quando a linha não informa uma. Em arquivos JSON, a seção "config" do arquivo prevalece sobre estes campos.</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Arquivo CSV ou JSON</span>
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input-base file:mr-3 file:rounded-lg file:border-0 file:bg-fg/[0.08] file:px-3 file:py-1 file:text-xs file:text-text-primary"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-status-lost">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={importer.isPending}>
          {importer.isPending ? 'Importando…' : 'Importar arquivo'}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

/** Importa uma lista de empresas (CSV/JSON ≤1 MB, até 100 linhas) como uma campanha de base importada */
export function ImportDialog({ open, onClose, onCreated }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Importar empresas" description="Sua base de contatos" className="max-w-xl">
      <ImportForm onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}
