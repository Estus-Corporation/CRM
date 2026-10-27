interface Props {
  title: string;
  milestone: string;
}

export function ComingSoonPage({ title, milestone }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="page-title">{title}</h1>
      <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-accent-green/10 flex items-center justify-center">
          <span className="text-accent-green text-xl">🚧</span>
        </div>
        <p className="text-text-secondary text-sm">Coming in {milestone}</p>
      </div>
    </div>
  );
}
