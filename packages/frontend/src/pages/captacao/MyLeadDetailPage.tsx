import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PhoneOff } from 'lucide-react';
import { useMyLead } from '@/hooks/useCaptacao';
import { LeadCard } from '@/components/captacao/LeadCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

/** Página de um lead do captador: tudo sobre ele + o resultado da ligação */
export function MyLeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading, isError } = useMyLead(id);

  return (
    // mobile-sections: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-4 max-md:space-y-3">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Meus leads
        </button>
      </div>

      {isLoading && !lead ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : !lead || isError ? (
        <div>
          <div className="card">
            <EmptyState icon={PhoneOff} title="Lead não encontrado" description="Ele pode ter sido removido ou não está mais com você." />
          </div>
        </div>
      ) : (
        <LeadCard lead={lead} detail />
      )}
    </div>
  );
}
