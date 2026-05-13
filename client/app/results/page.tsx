import AddWebsite from "@/components/AddWebsite";

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6 lg:px-8 lg:pb-8 lg:pt-4">
      <section className="panel-strong relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="hero-orb left-[6%] top-[-2rem] h-32 w-32 bg-emerald-200/65" />
        <div className="hero-orb right-[12%] top-[15%] h-24 w-24 bg-sky-200/70" />

        <div className="relative flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Regression Review</p>
            <h1 className="section-title mt-4 text-5xl sm:text-6xl">Scan Results</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review page-level regressions, compare baselines against current captures, inspect DOM drift, and export reports.
            </p>
          </div>

          <div className="hidden gap-3 sm:grid sm:grid-cols-3">
            <div className="metric-card h-20 w-24 rounded-[24px]" />
            <div className="metric-card h-20 w-24 rounded-[24px]" />
            <div className="metric-card h-20 w-24 rounded-[24px]" />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <AddWebsite />
      </section>
    </main>
  );
}
