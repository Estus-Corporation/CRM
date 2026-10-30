import { usePageSubtitle } from '@/store/pageStore';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  // A descrição vai pro topo, ao lado de "espaço › tela" (Topbar)
  usePageSubtitle(subtitle);
  return (
    // Celular: título em cima, ações numa linha própria embaixo (não espremem o subtítulo)
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2 max-sm:w-full">{actions}</div>}
    </div>
  );
}
