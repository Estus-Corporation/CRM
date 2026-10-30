import { useState } from 'react';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ExpensesTab } from './ExpensesTab';
import { PartnersTab } from './PartnersTab';
import { TaxesTab } from './TaxesTab';

type Tab = 'expenses' | 'taxes' | 'partners';

const TABS: { value: Tab; label: string }[] = [
  { value: 'expenses', label: 'Gastos' },
  { value: 'taxes', label: 'Impostos' },
  { value: 'partners', label: 'Sócios' },
];

/** Configuração do financeiro: gastos (mensais e avulsos), impostos sobre a receita e sócios */
export function FinanceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('expenses');

  return (
    <Modal open={open} onClose={onClose} title="Configurar financeiro" className="max-w-2xl">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-fg/[0.1] bg-fg/[0.03] px-3 py-2 text-[12.5px] text-text-secondary">
        <Info size={15} className="mt-0.5 flex-shrink-0" />
        <span>Alterações valem para todos os meses, inclusive os já passados.</span>
      </div>
      <div className="mb-4">
        <SegmentedControl layoutId="finance-settings-tab" options={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'taxes' && <TaxesTab />}
        {tab === 'partners' && <PartnersTab />}
      </div>
    </Modal>
  );
}
