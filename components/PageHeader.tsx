interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Kepala halaman: judul di atas garis tipis, deskripsi satu blok pendek.
 * Lebar teks dibatasi ~62 karakter supaya paragraf tidak melebar di desktop.
 */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-[#2b2222] pb-4">
      <div>
        <h1 className="font-display text-[27px] font-semibold leading-none tracking-[-0.03em] text-white sm:text-[33px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-zinc-400">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
