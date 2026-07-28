export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          {title}
        </h1>
        {description ? <p className="text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
