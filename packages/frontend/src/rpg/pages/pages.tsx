import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Download, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useRpg } from '../store';
import { PageTitle, Panel } from '../ui';

// ── Configurações ───────────────────────────────────────────────────────────

export function Settings() {
  const { name, setName, reset, exportData, importData } = useRpg();
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `life-rpg-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (importData(await file.text())) toast.success('Backup restaurado');
    else toast.error('Arquivo inválido');
  };

  return (
    <div className="max-w-xl space-y-5">
      <PageTitle title="Configurações" />
      <Panel icon={Sparkles} title="Personagem">
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="input-base h-10 w-full text-sm" />
      </Panel>
      <Panel icon={Download} title="Backup" subtitle="Os dados e as fotos ficam só neste navegador. Guarde uma cópia de vez em quando.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}><Download size={15} /> Baixar backup</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Restaurar</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </Panel>
      <Panel icon={RotateCcw} title="Recomeçar" subtitle="Apaga coleções, wishlist e gastos deste navegador.">
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => { reset(); setConfirm(false); }}>Apagar tudo</Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirm(true)}>Recomeçar do zero</Button>
        )}
      </Panel>
    </div>
  );
}
