import { motion } from 'framer-motion';
import { dialogMotion, overlayMotion } from '@/lib/motion';
import { useRef, useState } from 'react';
import { Smartphone, Upload, X, Check, Loader2, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { contactsService } from '@/services/contacts.service';
import { parseVCard, type ParsedContact } from '@/utils/parseVCard';

interface Props {
  onClose: () => void;
}

const hasContactPicker =
  typeof navigator !== 'undefined' && 'contacts' in navigator;

export function ImportContactsModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'pick' | 'preview' | 'done'>('pick');
  const [candidates, setCandidates] = useState<ParsedContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  // ── Contact Picker API (Android Chrome) ──────────────────────────────────
  async function handleContactPicker() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: true });
      const parsed: ParsedContact[] = raw
        .filter((c: { name: string[] }) => c.name?.[0])
        .map((c: { name: string[]; tel: string[]; email: string[] }) => {
          const digits = (c.tel?.[0] ?? '').replace(/\D/g, '').slice(-11);
          const phone =
            digits.length === 11
              ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
              : digits.length === 10
              ? `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
              : c.tel?.[0] || undefined;
          return { fullName: c.name[0], phone, email: c.email?.[0] || undefined };
        });

      if (parsed.length === 0) return;
      setCandidates(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
      setStep('preview');
    } catch {
      toast.error('Não foi possível acessar a agenda.');
    }
  }

  // ── vCard file upload (iOS / desktop) ────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseVCard(text);
      if (parsed.length === 0) {
        toast.error('Nenhum contato encontrado no arquivo.');
        return;
      }
      setCandidates(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
      setStep('preview');
    };
    reader.readAsText(file);
  }

  // ── Toggle selection ─────────────────────────────────────────────────────
  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((_, i) => i)),
    );
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImport() {
    const toImport = candidates.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const res = await contactsService.importBulk(toImport);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setResult({ imported: res.imported, skipped: res.skipped });
      setStep('done');
    } catch {
      toast.error('Erro ao importar contatos.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/55" onClick={onClose} {...overlayMotion} />
      <motion.div
        {...dialogMotion}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-fg/[0.08] bg-bg-surface shadow-[0_32px_80px_-20px_rgba(0,0,0,0.55)]"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-accent-green" />
            <span className="font-semibold text-sm">Importar contatos</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Step: pick ── */}
        {step === 'pick' && (
          <div className="p-5 flex flex-col gap-3">
            {hasContactPicker && (
              <button
                onClick={handleContactPicker}
                className="flex items-center gap-4 p-4 rounded-xl border border-bg-border bg-bg-primary hover:border-accent-green hover:bg-accent-green/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-accent-green/10 flex items-center justify-center shrink-0 group-hover:bg-accent-green/20 transition-colors">
                  <Smartphone size={18} className="text-accent-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Importar da agenda</p>
                  <p className="text-xs text-text-secondary mt-0.5">Selecione contatos diretamente do celular</p>
                </div>
              </button>
            )}

            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-4 p-4 rounded-xl border border-bg-border bg-bg-primary hover:border-accent-green hover:bg-accent-green/5 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-accent-green/10 flex items-center justify-center shrink-0 group-hover:bg-accent-green/20 transition-colors">
                <Upload size={18} className="text-accent-green" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Importar arquivo vCard</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {hasContactPicker ? 'iOS — envie um arquivo .vcf' : 'Selecione um arquivo .vcf'}
                </p>
              </div>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".vcf,text/vcard"
              className="hidden"
              onChange={handleFileChange}
            />

            <p className="text-xs text-text-muted text-center pt-1">
              Os contatos serão importados como <span className="text-text-secondary">leads</span>
            </p>
          </div>
        )}

        {/* ── Step: preview ── */}
        {step === 'preview' && (
          <>
            <div className="px-5 py-3 border-b border-bg-border shrink-0 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                {selected.size} de {candidates.length} selecionados
              </span>
              <button onClick={toggleAll} className="text-xs text-accent-green hover:underline">
                {selected.size === candidates.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>

            <ul className="overflow-y-auto scrollbar-surface flex-1 divide-y divide-bg-border">
              {candidates.map((c, i) => {
                const isSelected = selected.has(i);
                return (
                  <li
                    key={i}
                    onClick={() => toggle(i)}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors',
                      isSelected ? 'bg-accent-green/5' : 'hover:bg-bg-border/40',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'bg-accent-green border-accent-green' : 'border-bg-border',
                    )}>
                      {isSelected && <Check size={11} className="text-bg-darker" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{c.fullName}</p>
                      <p className="text-xs text-text-secondary truncate">
                        {[c.phone, c.email, c.company].filter(Boolean).join(' · ') || 'Sem detalhes'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 py-4 border-t border-bg-border flex gap-2 shrink-0">
              <Button variant="ghost" onClick={() => setStep('pick')} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                className="flex-1"
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Importando…
                  </span>
                ) : (
                  `Importar ${selected.size}`
                )}
              </Button>
            </div>
          </>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && result && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-accent-green/10 flex items-center justify-center">
              <Check size={28} className="text-accent-green" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-semibold text-text-primary">Importação concluída</p>
              <p className="text-sm text-text-secondary mt-1">
                <span className="text-accent-green font-medium">{result.imported}</span> importados
                {result.skipped > 0 && (
                  <> · <span className="text-text-muted">{result.skipped}</span> ignorados (duplicados)</>
                )}
              </p>
            </div>
            <Button onClick={onClose} className="w-full mt-2">Fechar</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
