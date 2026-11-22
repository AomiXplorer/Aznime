interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="relative mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line">
      <div className="relative pb-4">
        <h1 className="font-display text-[1.75rem] font-bold leading-tight text-ink sm:text-[2.1rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p> : null}
        <span aria-hidden="true" className="absolute -bottom-px left-0 h-0.5 w-12 bg-accent" />
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2 pb-4">{children}</div> : null}
    </div>
  );
}
