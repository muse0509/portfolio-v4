import { siteContent } from "@/content/site";

export default function Home() {
  const { foundation, hero } = siteContent;

  return (
    <main className="min-h-svh overflow-hidden bg-background text-foreground">
      <section
        aria-labelledby="foundation-heading"
        className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12 lg:py-12"
      >
        <header className="flex items-center justify-between gap-6 border-b border-border pb-6">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground sm:text-sm">
            {hero.eyebrow}
          </p>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {foundation.phase}
          </p>
        </header>

        <div className="flex flex-1 items-center py-20 sm:py-24 lg:py-32">
          <div className="max-w-5xl">
            <p className="mb-8 text-sm font-medium tracking-[0.16em] text-muted-foreground">
              {foundation.label}
            </p>
            <h1
              id="foundation-heading"
              aria-label={hero.headline}
              className="text-3xl font-medium leading-tight tracking-tight sm:text-6xl lg:text-7xl"
            >
              {hero.headlineLines.map((line) => (
                <span key={line} aria-hidden="true" className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-8 max-w-2xl text-pretty text-base leading-8 text-muted-foreground sm:mt-10 sm:text-lg">
              {hero.description}
            </p>

            <aside
              aria-label="開発ステータス"
              className="mt-12 inline-flex items-center rounded-full border border-border bg-surface px-4 py-3 sm:mt-16"
            >
              <span
                aria-hidden="true"
                className="mr-3 size-2 rounded-full bg-foreground"
              />
              <p className="text-sm text-muted-foreground">{hero.status}</p>
            </aside>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{foundation.readiness}</p>
          <p>{foundation.runtime}</p>
        </footer>
      </section>
    </main>
  );
}
