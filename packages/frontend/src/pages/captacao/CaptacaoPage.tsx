import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, FileSpreadsheet, Plus, Settings, UserPlus } from 'lucide-react';
import { useTenant, isCompanyProfileComplete } from '@/hooks/useTenant';
import { useAuthStore } from '@/store/authStore';
import { useCaptacaoSettings, useUpdateCaptacaoSettings } from '@/hooks/useCaptacao';
import type { CaptacaoSettings } from '@/services/captacao.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CaptadoresTab } from '@/components/captacao/CaptadoresTab';
import { DistributeTab } from '@/components/captacao/DistributeTab';
import { TrackingTab } from '@/components/captacao/TrackingTab';
import { AddMemberModal } from '@/components/team/AddMemberModal';
import { AddLeadModal } from '@/components/captacao/AddLeadModal';
import { ImportLeadsModal } from '@/components/captacao/ImportLeadsModal';

type Tab = 'team' | 'distribute' | 'tracking';

const TABS: { value: Tab; label: string }[] = [
  { value: 'team', label: 'Equipe e comissões' },
  { value: 'distribute', label: 'Distribuir leads' },
  { value: 'tracking', label: 'Acompanhamento' },
];

/** Engrenagem da Captação: comissão e cota diária da distribuição automática */
function SettingsModal({ open, onClose, current }: { open: boolean; onClose: () => void; current: CaptacaoSettings }) {
  const update = useUpdateCaptacaoSettings();
  const [rate, setRate] = useState(String(current.commissionRate));
  const [perDay, setPerDay] = useState(String(current.leadsPerDay));
  useEffect(() => {
    setRate(String(current.commissionRate));
    setPerDay(String(current.leadsPerDay));
  }, [current.commissionRate, current.leadsPerDay, open]);

  const rateValue = Number(rate.replace(',', '.'));
  const perDayValue = Number(perDay);
  const valid =
    Number.isFinite(rateValue) && rateValue >= 0 && rateValue <= 100 &&
    Number.isInteger(perDayValue) && perDayValue >= 0 && perDayValue <= 200;

  return (
    <Modal open={open} onClose={onClose} title="Configurações da captação" description="Valem para todos os captadores deste workspace.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) update.mutate({ commissionRate: rateValue, leadsPerDay: perDayValue }, { onSuccess: onClose });
        }}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text-primary">Leads por captador por dia</span>
            <input
              autoFocus
              type="number"
              min={0}
              max={200}
              value={perDay}
              onChange={(e) => setPerDay(e.target.value.replace(/[^0-9]/g, ''))}
              className="input-base h-10 w-24 text-center tabular-nums"
            />
          </label>
          <p className="text-xs text-text-muted">
            Distribuição automática: todo dia, ao abrir “Meus leads”, cada captador recebe leads livres da fila (os mais
            antigos primeiro) até completar esse número. O que você atribuir à mão no dia também conta. Use 0 para desligar.
          </p>
        </div>

        <div className="space-y-1.5 border-t border-bg-border pt-5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text-primary">Comissão sobre o valor fechado (%)</span>
            <input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
              className="input-base h-10 w-24 text-center tabular-nums"
            />
          </label>
          <p className="text-xs text-text-muted">Fechamentos já registrados mantêm o percentual da época.</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid || update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Painel do admin/gerente para a operação de captação de leads */
export function CaptacaoPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const navigate = useNavigate();
  const { data: tenant } = useTenant();
  const { data: settings } = useCaptacaoSettings();
  const commissionRate = settings?.commissionRate ?? 8;
  const leadsPerDay = settings?.leadsPerDay ?? 10;

  const [tab, setTab] = useState<Tab>('team');
  const [trackingCaptador, setTrackingCaptador] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <PageHeader
        title="Captação"
        subtitle="Distribua leads, acompanhe as ligações e controle as comissões"
        actions={
          <>
            {isAdmin && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setRateOpen(true)}
                title="Configurações da captação (leads por dia, comissão)"
                aria-label="Configurações da captação"
                className="w-11 px-0"
              >
                <Settings size={18} />
              </Button>
            )}
            {/* Aba Distribuir: a ação principal vira cadastrar leads (mesmo lugar/tamanho do Adicionar captador) */}
            {tab === 'distribute' ? (
              <>
                <Button variant="secondary" size="lg" onClick={() => setImportOpen(true)} title="Cadastrar leads a partir de uma planilha Excel ou CSV">
                  <FileSpreadsheet size={17} />
                  Importar planilha
                </Button>
                <Button size="lg" onClick={() => setAddLeadOpen(true)} className="px-6 text-[15px]">
                  <Plus size={18} strokeWidth={2.25} />
                  Adicionar lead
                </Button>
              </>
            ) : (
              isAdmin && (
                <Button size="lg" onClick={() => setNewOpen(true)} className="px-6 text-[15px]">
                  <UserPlus size={18} strokeWidth={2.25} />
                  Adicionar captador
                </Button>
              )
            )}
          </>
        }
      />

      {/* Captador aprende o que vender em "Sobre a empresa": lembra o admin enquanto estiver vazio */}
      {isAdmin && tenant && !isCompanyProfileComplete(tenant) && (
        <div>
        <div className="card flex flex-wrap items-center gap-3 border-accent-amber/30 p-4">
          <Building2 size={18} className="flex-shrink-0 text-accent-amber" />
          <p className="min-w-[220px] flex-1 text-sm text-text-secondary">
            <strong className="text-text-primary">Preencha o perfil da empresa.</strong> Seus captadores leem a página
            “Sobre a empresa” para entender o que vender, os preços e como abordar o cliente.
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/settings#empresa')}>
            Preencher agora
          </Button>
        </div>
        </div>
      )}

      {/* Abas: segmentado no desktop, dropdown no celular (sem rolagem lateral) */}
      <div>
        <SegmentedControl layoutId="captacao-tabs" options={TABS} value={tab} onChange={setTab} className="max-md:hidden" />
        <SelectDropdown title="Seção" options={TABS} value={tab} onChange={setTab} className="w-full md:hidden" />
      </div>

      {tab === 'team' && (
        <CaptadoresTab
          isAdmin={isAdmin}
          onNewCaptador={() => setNewOpen(true)}
          onViewLeads={(id) => {
            setTrackingCaptador(id);
            setTab('tracking');
          }}
        />
      )}
      {tab === 'distribute' && (
        <DistributeTab
          leadsPerDay={leadsPerDay}
          onAddLead={() => setAddLeadOpen(true)}
          onOpenSettings={isAdmin ? () => setRateOpen(true) : undefined}
        />
      )}
      {tab === 'tracking' && (
        <TrackingTab
          isAdmin={isAdmin}
          commissionRate={commissionRate}
          captadorId={trackingCaptador}
          onCaptadorChange={setTrackingCaptador}
        />
      )}

      <AddMemberModal open={newOpen} onClose={() => setNewOpen(false)} fixedRole="captador" />
      <SettingsModal open={rateOpen} onClose={() => setRateOpen(false)} current={{ commissionRate, leadsPerDay }} />
      <AddLeadModal open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />
      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
