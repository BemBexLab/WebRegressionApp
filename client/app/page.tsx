import AddWebsite from "@/components/AddWebsite";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6 md:p-10">
      <h1 className="text-3xl font-bold text-white md:text-4xl">
        Website Regression Monitoring SaaS Platform
      </h1>
      <p className="max-w-3xl text-sm text-white md:text-base">
        Enter only the URL. The app creates baselines, runs visual + DOM regression scans, and stores
        realtime scan data in Supabase.
      </p>
      
      {/* <section className="space-y-6 rounded-lg border border-white/20 bg-white/10 p-6 text-white backdrop-blur">
        <div>
          <h2 className="text-xl font-semibold">Visual Regression Engine</h2>
          <p className="text-sm text-white/80">Detect visual differences between current and baseline website states.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-white/20 bg-white/5 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Scope</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>Capture full-page screenshots</li>
              <li>Compare against stored baseline images</li>
              <li>Generate difference images</li>
              <li>Calculate mismatch percentage</li>
              <li>Configurable sensitivity threshold per site</li>
              <li>Ability to ignore specific page sections</li>
              <li>Desktop and optional mobile viewport support</li>
            </ul>
          </div>
          <div className="rounded-md border border-white/20 bg-white/5 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Output</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>Before image</li>
              <li>After image</li>
              <li>Highlighted diff image</li>
              <li>Percentage difference</li>
              <li>Change status (Pass / Warning / Critical)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-lg border border-white/20 bg-white/10 p-6 text-white backdrop-blur">
        <div>
          <h2 className="text-xl font-semibold">HTML / DOM Regression Detection</h2>
          <p className="text-sm text-white/80">
            Detect structural and content changes that may not be visually obvious.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-white/20 bg-white/5 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Scope</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>Capture cleaned HTML snapshot</li>
              <li>Remove dynamic content (timestamps, session IDs, tokens)</li>
              <li>Compare against baseline DOM</li>
              <li>Detect element removal</li>
              <li>Detect element addition</li>
              <li>Detect attribute changes</li>
              <li>Detect text changes</li>
              <li>Store diff results</li>
              <li>Show structured change summary</li>
            </ul>
          </div>
          <div className="rounded-md border border-white/20 bg-white/5 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Output</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>DOM diff log</li>
              <li>List of changed selectors</li>
              <li>Severity level</li>
            </ul>
          </div>
        </div>
      </section> */}

      {/* <section className="space-y-6 rounded-lg border border-white/20 bg-white/10 p-6 text-white backdrop-blur">
        <div>
          <h2 className="text-xl font-semibold">Functional / Smoke Testing Engine</h2>
          <p className="text-sm text-white/80">Detect broken functionality or backend errors.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-white/20 bg-white/5 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Scope</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>HTTP status code monitoring</li>
              <li>Page load time measurement</li>
              <li>Core element existence check</li>
              <li>Console error detection</li>
              <li>Broken link detection</li>
              <li>Form availability check</li>
              <li>Optional flow testing (example: Home → Contact → Submit form open)</li>
            </ul>
          </div>
          <div className="rounded-md border border-white/20 bg-white/5 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">Advanced (Phase 2)</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>Login flow testing</li>
              <li>Checkout testing</li>
              <li>API health testing</li>
            </ul>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-white/70">Output</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              <li>Response code</li>
              <li>Load time</li>
              <li>JS error logs</li>
              <li>Functional status (Healthy / Failed)</li>
            </ul>
          </div>
        </div>
      </section> */}

      <AddWebsite />
    </main>
  );
}
