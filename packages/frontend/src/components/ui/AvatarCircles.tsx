import * as Tooltip from '@radix-ui/react-tooltip';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export interface AvatarCirclesPerson {
  id: string;
  name: string;
  src?: string | null;
  /** Segunda linha do tooltip (ex.: papel) */
  subtitle?: string;
}

interface AvatarCirclesProps {
  className?: string;
  people: AvatarCirclesPerson[];
  /** Quantas fotos aparecem; o resto vira o círculo "+N" */
  max?: number;
}

/** Fotos sobrepostas + "+N". Ao passar o mouse a foto sobe e cresce, e o tooltip diz quem é */
const AvatarCircles = ({ className, people, max = 5 }: AvatarCirclesProps) => {
  const shown = people.slice(0, max);
  const rest = people.slice(max);

  return (
    <Tooltip.Provider delayDuration={0}>
      <div className={cn('z-10 flex -space-x-4 px-1 py-1.5', className)}>
        {shown.map((p) => (
          <Tooltip.Root key={p.id}>
            <Tooltip.Trigger asChild>
              <span className="relative rounded-full border-2 border-bg-primary bg-bg-surface transition-all duration-200 ease-out hover:z-20 hover:-translate-y-1.5 hover:scale-110 hover:border-accent-green">
                <Avatar name={p.name} src={p.src} className="h-10 w-10 text-sm" />
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={10}
                className="z-[60] rounded-md border border-bg-border bg-bg-surface px-2.5 py-1.5 text-[13px] shadow-lg shadow-black/40"
              >
                <span className="block font-medium text-text-primary">{p.name}</span>
                {p.subtitle && <span className="block text-[11px] text-text-muted">{p.subtitle} · online</span>}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
        {rest.length > 0 && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="relative flex h-10 w-10 cursor-default items-center justify-center rounded-full border-2 border-bg-primary bg-fg text-center text-xs font-medium text-bg-primary transition-all duration-200 ease-out hover:z-20 hover:-translate-y-1.5 hover:scale-110">
                +{rest.length}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={10}
                className="z-[60] rounded-md border border-bg-border bg-bg-surface px-2.5 py-1.5 text-[13px] text-text-primary shadow-lg shadow-black/40"
              >
                {rest.map((p) => (
                  <span key={p.id} className="block">
                    {p.name}
                  </span>
                ))}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
      </div>
    </Tooltip.Provider>
  );
};

export { AvatarCircles };
