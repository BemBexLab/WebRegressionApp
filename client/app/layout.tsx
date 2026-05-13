import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/websites", label: "Websites" },
  { href: "/results", label: "Scan Center" },
  { href: "/reports", label: "Reports" },
  { href: "/alerts", label: "Alerts" },
  { href: "/billing", label: "Billing" },
  { href: "/admin", label: "Admin" }
];

const statusPills = ["Visual", "DOM", "Smoke", "Reports"];

export const metadata: Metadata = {
  title: "Website Regression Monitoring SaaS Platform",
  description: "SaaS dashboard for visual regression monitoring, DOM drift detection, smoke testing, and reporting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="antialiased">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(140,255,228,0.22),transparent_58%)]" />

          <header className="relative z-10">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
                  <div className="h-5 w-5 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f7fffd_0%,#8bffdf_38%,#0f6b63_100%)]" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">Website Regression</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Monitoring SaaS</p>
                </div>
              </Link>

              <div className="hidden items-center gap-3 md:flex">
                <nav className="panel flex items-center gap-2 rounded-full px-2 py-2">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-full px-4 py-2 text-sm text-[var(--muted)] transition hover:bg-white/8 hover:text-[var(--foreground)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="panel flex items-center gap-2 rounded-full px-3 py-2">
                  {statusPills.map((pill) => (
                    <span key={pill} className="tag">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {children}

          <footer className="relative z-10 mx-auto mt-10 max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="panel flex flex-col gap-3 rounded-[28px] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Website Regression Monitoring SaaS Platform</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Visual / DOM / Functional / Reporting
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
