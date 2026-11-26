import { PROMOTORS } from '@/lib/credits';

function TikTokGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[#fda4af] transition-transform duration-200 group-hover/btn:scale-110"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1Z" />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[#fda4af] transition-transform duration-200 group-hover/btn:scale-110"
    >
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.31-1.65a11.88 11.88 0 0 0 5.75 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.44ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.87 9.87 0 0 1-1.52-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 7c0 5.45-4.44 9.89-9.88 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

export function PromotorSection() {
  return (
    <section aria-labelledby="credit-promotor" className="mt-16">
      <div className="credit-fade-up group/head flex items-end justify-between gap-4 border-b border-line pb-5 [animation-delay:360ms]">
        <div>
          <p className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">
            <span
              aria-hidden="true"
              className="red-dash-glint h-[1.5px] w-7 bg-accent transition-all duration-300 group-hover/head:w-11"
            />
            Aznime · Promotors
          </p>
          <h2
            id="credit-promotor"
            className="mt-3 font-display text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-none tracking-[-0.04em] text-white"
          >
            Credit Promotor
          </h2>
        </div>

        <span className="font-mono text-[11px] tabular-nums tracking-[0.2em] text-zinc-500">
          {String(PROMOTORS.length).padStart(2, '0')}
        </span>
      </div>

      <ol className="divide-y divide-line border-b border-line">
        {PROMOTORS.map((promotor, idx) => (
          <li
            key={promotor.id}
            style={{ animationDelay: `${(idx + 6) * 75}ms` }}
            className="credit-fade-up group relative py-8 after:pointer-events-none after:absolute after:bottom-[-1px] after:left-0 after:h-[1.5px] after:w-0 after:bg-accent/80 after:transition-all after:duration-500 after:ease-out hover:after:w-full"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-line bg-zinc-900 transition-colors duration-300 group-hover:border-[#fda4af]/50 sm:h-16 sm:w-16">
                  <img
                    src={promotor.avatar}
                    alt={promotor.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.26em] text-zinc-500">
                    <span className="tabular-nums transition-colors duration-200 group-hover:text-zinc-300">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span
                      aria-hidden="true"
                      className="red-dash-glint h-[1.5px] w-6 bg-accent transition-all duration-300 group-hover:w-10"
                    />
                    <span>Promotor</span>
                  </p>

                  <h3 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[25px]">
                    {promotor.name}
                  </h3>

                  <p className="mt-1.5 flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-zinc-400">
                    <span className="uppercase text-zinc-500">
                      {promotor.platform === 'tiktok' ? 'TikTok' : 'Channel'}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-accent transition-transform duration-300 group-hover:scale-125"
                    />
                    <span className="tracking-normal text-[#fda4af]">
                      {promotor.handle}
                    </span>
                  </p>

                  <p className="mt-3 max-w-[54ch] text-[13.5px] leading-relaxed text-zinc-400">
                    {promotor.bio}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto sm:shrink-0">
                <a
                  href={promotor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#3a2b2d] bg-[#110c0d]/80 px-4 py-3 text-[13px] font-medium text-white transition-all duration-200 hover:border-[#6d2637] hover:bg-[#6d2637] active:scale-[0.99] sm:w-auto sm:min-w-[148px]"
                >
                  {promotor.platform === 'tiktok' ? <TikTokGlyph /> : <WhatsAppGlyph />}
                  <span>{promotor.buttonLabel}</span>
                  <span
                    aria-hidden="true"
                    className="text-[11px] text-zinc-400 transition-transform duration-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 group-hover/btn:text-white"
                  >
                    ↗
                  </span>
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
