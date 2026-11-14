export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-6">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
