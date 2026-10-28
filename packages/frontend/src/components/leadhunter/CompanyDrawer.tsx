import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { overlayMotion } from '@/lib/motion';
import type { Campaign, Company, LeadHunterPriority, SearchCoverage } from '@/services/leadhunter.service';
import { useUpdateCompany } from '@/hooks/useLeadHunter';
import { FollowUpSection, InstagramSection } from './CompanyActions';
import { CrmStatus, History, MainInfo, Reasons, Visibility } from './CompanySections';
import { PRIORITY_LABEL } from './companyLabels';

const PRIORITY_VARIANT = { high: 'green', medium: 'manager', low: 'default', review: 'blue', excluded: 'red' } as const;

const Notice = ({ children }: { children: string }) => (
  <p role="note" className="rounded-xl bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber">
    {children}
  </p>
);

interface Props {
  /**
   * O pai DEVE derivar a empresa dos dados vivos do `useCampaign` (buscando por id), nunca guardar o objeto em state:
   * `useUpdateCompany` só invalida a query da campanha, então um snapshot mostraria etapa/Instagram desatualizados.
   */
  company: Company | null;
  campaign: Campaign;
  /** Buscas concluídas da campanha, para listar onde a empresa não apareceu: o pai DEVERIA passar `data.coverage` do `useCampaign` */
  coverage?: SearchCoverage[];
  onClose: () => void;
}

/** Ficha da empresa em painel lateral (tela cheia no celular). Fechada quando `company` é nulo. */
export function CompanyDrawer({ company, campaign, coverage = [], onClose }: Props) {
  return (
    <Dialog.Root open={!!company} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {company && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40 bg-black/55" {...overlayMotion} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.08 }}
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-hidden border-l border-fg/[0.08] bg-bg-surface shadow-[0_32px_80px_-20px_rgba(0,0,0,0.55)] focus:outline-none"
              >
                {/* key: trocar de empresa reinicia os campos de edição */}
                <DrawerBody key={company.id} company={company} campaign={campaign} coverage={coverage} onClose={onClose} />
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function DrawerBody({ company, campaign, coverage, onClose }: Omit<Props, 'company'> & { company: Company; coverage: SearchCoverage[] }) {
  const analysis = company.analysis;
  const priority: LeadHunterPriority | undefined = analysis?.priority;
  const update = useUpdateCompany();
  const regionReview = company.regionReview ?? analysis?.fit?.regionReview;

  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-fg/[0.08] px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-muted">Ficha da empresa</p>
          <Dialog.Title className="break-words text-lg font-semibold text-text-primary">{company.name}</Dialog.Title>
          <p className="break-words text-sm text-text-secondary">{company.address || 'Endereço não informado'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar ficha"
          className="flex-shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
        >
          <X size={17} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={priority ? PRIORITY_VARIANT[priority] : 'blue'}>
            {priority ? PRIORITY_LABEL[priority] : 'Em análise'} · {analysis?.score ?? '—'}/100
          </Badge>
          <Badge>{analysis?.completeness ?? 0}% dos campos disponíveis</Badge>
        </div>
        {campaign.config.source === 'demo' && <Notice>Empresa fictícia. Estes dados não representam um negócio real.</Notice>}
        {regionReview && <Notice>Cidade não retornada de forma estruturada. Confira a região antes da abordagem.</Notice>}

        <MainInfo company={company} />
        <Reasons company={company} />
        <InstagramSection company={company} update={update} />
        <Visibility company={company} coverage={coverage} />
        <History companyId={company.id} />
        <CrmStatus company={company} />
        <FollowUpSection company={company} update={update} onClose={onClose} />
      </div>
    </>
  );
}
