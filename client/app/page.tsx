import AddWebsite from "@/components/AddWebsite";

const capabilityCards = [
  {
    eyebrow: "Visual Intelligence",
    title: "Catch UI drift before customers do",
    description:
      "Full-page baselines, diff overlays, mismatch scoring, and issue-first review flows keep visual regressions easy to spot."
  },
  {
    eyebrow: "DOM Breakdown",
    title: "Inspect structural changes with context",
    description:
      "Track selector-level changes, compare before and after snippets, and follow a timeline of page mutations across scans."
  },
  {
    eyebrow: "Smoke Coverage",
    title: "Monitor live functionality when needed",
    description:
      "Enable smoke checks for status codes, console failures, broken links, forms, and lightweight contact-flow validation."
  }
];

const overviewStats = [
  { value: "3-in-1", label: "visual, DOM, and smoke coverage" },
  { value: "Issue-first", label: "regression detail workflow" },
  { value: "Queue-backed", label: "parallel worker execution" }
];

export default function Home() {
  return (
    <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 px-6 py-8 sm:px-8 lg:px-10 lg:py-12 glass-panel-strong reveal-up">
        <div className="hero-orb left-[-4rem] top-[-3rem] h-36 w-36 bg-emerald-300/45" />
        <div className="hero-orb right-[8%] top-[14%] h-28 w-28 bg-sky-400/40" />
        <div className="hero-orb bottom-[-2rem] right-[-1rem] h-40 w-40 bg-teal-300/25" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/90 reveal-up reveal-delay-1">
              Regression Operations Console
            </div>

            <div className="space-y-4 reveal-up reveal-delay-2">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Professional website regression monitoring with a sharper command center.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-200/88 sm:text-lg">
                Run visual and DOM regression scans, switch on smoke testing when you need functional
                coverage, and review each issue inside a polished side-by-side comparison workflow.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 reveal-up reveal-delay-3">
              {overviewStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <p className="text-xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-200/75">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 reveal-up reveal-delay-2">
            {capabilityCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                  {card.eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200/78">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] p-[1px] reveal-up reveal-delay-1 bg-[linear-gradient(135deg,rgba(126,240,214,0.6),rgba(255,255,255,0.06),rgba(92,159,255,0.5))]">
          <div className="soft-grid rounded-[27px] bg-[rgba(5,18,26,0.88)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
              Visual Regression
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">Diff-focused review surface</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300/85">
              Baseline snapshots, current captures, diff overlays, and mismatch percentages sit together
              in a cleaner investigation layout.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] p-[1px] reveal-up reveal-delay-2 bg-[linear-gradient(135deg,rgba(92,159,255,0.55),rgba(255,255,255,0.06),rgba(126,240,214,0.36))]">
          <div className="rounded-[27px] bg-[rgba(5,18,26,0.88)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/85">
              Functional Signals
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">Toggle smoke testing on demand</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300/85">
              Keep lightweight scans by default, or add status code checks, console logs, broken-link
              detection, and form coverage with one switch.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] p-[1px] reveal-up reveal-delay-3 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06),rgba(126,240,214,0.34))]">
          <div className="rounded-[27px] bg-[rgba(5,18,26,0.88)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-200/82">
              Worker Pipeline
            </p>
            <h3 className="mt-3 text-xl font-semibold text-white">Parallel queue orchestration</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300/85">
              Distributed-ready workers, retries, queue depth visibility, and timeout protection support
              more reliable scan execution.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 reveal-up reveal-delay-2">
        <AddWebsite />
      </section>
    </main>
  );
}
