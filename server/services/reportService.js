import { launchBrowser } from "./browserService.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function resolveImageUrl(path, baseUrl) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

function getFunctionalRegression(page = {}) {
  return page.functionalRegression ?? {
    status: "Not captured",
    responseCode: null,
    loadTimeMs: null,
    consoleErrors: [],
    brokenLinks: [],
    requestFailures: [],
    form: {
      available: false,
      count: 0,
      interactiveControlCount: 0
    },
    flow: {
      attempted: false,
      passed: true,
      details: "Functional data was not captured for this scan."
    }
  };
}

function hasDetectedIssue(page = {}) {
  const functional = getFunctionalRegression(page);
  return (
    (page.visualRegression?.mismatchPercentage ?? 0) > 0 ||
    (page.domRegression?.summary?.total ?? 0) > 0 ||
    functional.status === "Failed" ||
    (functional.brokenLinks?.length ?? 0) > 0 ||
    (functional.consoleErrors?.length ?? 0) > 0
  );
}

function renderImage(src, label) {
  if (!src) {
    return `<div class="image-empty">No ${escapeHtml(label)} image available.</div>`;
  }

  return `
    <div class="image-card">
      <div class="image-label">${escapeHtml(label)}</div>
      <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" />
    </div>
  `;
}

export function buildReportHtml(result) {
  const summary = result?.summary ?? {};
  const functionalSummary = result?.functionalSummary ?? {};
  const code = result?.codeRegression ?? null;
  const assetBaseUrl = process.env.REPORT_ASSET_BASE_URL || "";
  const pageResults = result?.pageResults ?? [];
  const issuePages = pageResults.filter(hasDetectedIssue);
  const allBrokenLinks = pageResults.flatMap((page) =>
    (getFunctionalRegression(page).brokenLinks ?? []).map((link) => ({
      pagePath: page.path,
      pageUrl: page.url,
      ...link
    }))
  );
  const pageRows = pageResults
    .map((page) => {
      const dom = page.domRegression?.summary ?? {};
      const functional = getFunctionalRegression(page);
      const changes = (page.domRegression?.diffLog ?? [])
        .map((entry) => {
          const selector = escapeHtml(entry.selector ?? "");
          const type = escapeHtml(entry.type ?? "");
          const before = entry.beforeHtml || escapeHtml(entry.oldHtml ?? "");
          const after = entry.afterHtml || escapeHtml(entry.newHtml ?? "");
          return `
            <div class="dom-change">
              <div class="dom-meta">
                <span class="pill">${type.replace(/_/g, " ")}</span>
                <span class="selector">${selector}</span>
              </div>
              <table class="dom-table">
                <thead>
                  <tr>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <pre class="dom-code">${before || "<span class='small'>No before HTML</span>"}</pre>
                    </td>
                    <td>
                      <pre class="dom-code">${after || "<span class='small'>No after HTML</span>"}</pre>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        })
        .join("");
      return `
        <tr>
          <td>${escapeHtml(page.path)}</td>
          <td>${escapeHtml(page.url)}</td>
          <td>${escapeHtml(page.visualRegression?.status)}</td>
          <td>${formatNumber(page.visualRegression?.mismatchPercentage)}</td>
          <td>${formatNumber(dom.total)}</td>
          <td>${escapeHtml(dom.severity)}</td>
          <td>${escapeHtml(functional.status)}</td>
          <td>${formatNumber(functional.brokenLinks?.length ?? 0)}</td>
        </tr>
        <tr>
          <td colspan="8">
            ${
              changes
                ? `<div class="dom-changes">${changes}</div>`
                : `<div class="small">No DOM changes captured for this page.</div>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  const issueSections = issuePages
    .map((page) => {
      const visual = page.visualRegression ?? {};
      const dom = page.domRegression?.summary ?? {};
      const functional = getFunctionalRegression(page);
      const baselineImage = resolveImageUrl(visual.baselineImageUrl, assetBaseUrl);
      const currentImage = resolveImageUrl(visual.currentImageUrl, assetBaseUrl);
      const diffImage = resolveImageUrl(visual.diffImageUrl, assetBaseUrl);
      const brokenLinks = functional.brokenLinks ?? [];
      const consoleErrors = functional.consoleErrors ?? [];

      return `
        <section class="issue page-row">
          <div class="issue-heading">
            <div>
              <h3>${escapeHtml(page.path)}</h3>
              <div class="small break">${escapeHtml(page.url)}</div>
            </div>
            <div class="issue-score">${formatNumber(visual.mismatchPercentage)}% mismatch</div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">Visual</div><div class="value">${escapeHtml(visual.status)}</div></div>
            <div class="card"><div class="label">DOM Changes</div><div class="value">${formatNumber(dom.total)}</div></div>
            <div class="card"><div class="label">Functional</div><div class="value">${escapeHtml(functional.status)}</div></div>
            <div class="card"><div class="label">Broken Links</div><div class="value">${formatNumber(brokenLinks.length)}</div></div>
            <div class="card"><div class="label">HTTP</div><div class="value">${escapeHtml(functional.responseCode ?? "N/A")}</div></div>
            <div class="card"><div class="label">Load Time</div><div class="value">${escapeHtml(functional.loadTimeMs ?? "N/A")} ms</div></div>
          </div>

          <div class="image-grid">
            ${renderImage(baselineImage, "Baseline")}
            ${renderImage(currentImage, "Current")}
            ${renderImage(diffImage, "Diff")}
          </div>

          <h4>Bad and Broken Links</h4>
          ${
            brokenLinks.length > 0
              ? `<table>
                  <thead><tr><th>URL</th><th>Status</th><th>Error</th></tr></thead>
                  <tbody>
                    ${brokenLinks.map((link) => `
                      <tr>
                        <td class="break">${escapeHtml(link.url)}</td>
                        <td>${escapeHtml(link.statusCode ?? "No response")}</td>
                        <td>${escapeHtml(link.error ?? "")}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>`
              : `<div class="small">No bad or broken links detected for this page.</div>`
          }

          <h4>Console Errors</h4>
          ${
            consoleErrors.length > 0
              ? consoleErrors.map((error) => `<pre class="dom-code">${escapeHtml(error)}</pre>`).join("")
              : `<div class="small">No console errors captured for this page.</div>`
          }
        </section>
      `;
    })
    .join("");

  const brokenLinkRows = allBrokenLinks
    .map((link) => `
      <tr>
        <td>${escapeHtml(link.pagePath)}</td>
        <td class="break">${escapeHtml(link.url)}</td>
        <td>${escapeHtml(link.statusCode ?? "No response")}</td>
        <td>${escapeHtml(link.error ?? "")}</td>
      </tr>
    `)
    .join("");

  const codeRows = code
    ? code.changedFiles
        .map((file) => {
          return `
            <tr>
              <td>${escapeHtml(file.status)}</td>
              <td>${escapeHtml(file.path)}</td>
              <td>${formatNumber(file.additions)}</td>
              <td>${formatNumber(file.deletions)}</td>
              <td>${formatNumber(file.changes)}</td>
            </tr>
          `;
        })
        .join("")
    : "";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Scan Report</title>
        <style>
	          body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
	          h1 { font-size: 22px; margin-bottom: 8px; }
	          h2 { font-size: 16px; margin-top: 28px; }
	          h3 { font-size: 15px; margin: 0 0 4px; }
	          h4 { font-size: 13px; margin: 16px 0 8px; }
	          .meta { font-size: 12px; color: #475569; margin-bottom: 18px; }
	          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
	          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; }
          .value { font-size: 15px; font-weight: 600; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; }
          .dom-changes { display: flex; flex-direction: column; gap: 14px; }
          .dom-change { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
          .dom-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
          .pill { font-size: 10px; text-transform: uppercase; padding: 2px 6px; border-radius: 999px; background: #f1f5f9; color: #0f172a; }
          .selector { font-size: 11px; color: #475569; }
          .dom-table { width: 100%; border-collapse: collapse; }
          .dom-table th, .dom-table td { border: 1px solid #e2e8f0; padding: 6px; font-size: 11px; text-align: left; vertical-align: top; }
          .dom-table th { background: #f8fafc; text-transform: uppercase; color: #64748b; }
          .dom-code { background: #0f172a; color: #e2e8f0; padding: 8px; border-radius: 6px; font-size: 10px; white-space: pre-wrap; word-break: break-word; }
          .diff-add { background: rgba(34, 197, 94, 0.2); }
          .diff-del { background: rgba(239, 68, 68, 0.2); text-decoration: line-through; }
	          .page-row { page-break-inside: avoid; }
	          .small { font-size: 11px; color: #64748b; }
	          .break { word-break: break-word; overflow-wrap: anywhere; }
	          .issue { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-top: 14px; }
	          .issue-heading { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
	          .issue-score { white-space: nowrap; border-radius: 999px; background: #ecfeff; border: 1px solid #a5f3fc; color: #155e75; font-size: 11px; font-weight: 700; padding: 4px 8px; }
	          .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
	          .image-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; page-break-inside: avoid; }
	          .image-label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; font-weight: 700; }
	          .image-card img { width: 100%; max-height: 220px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; }
	          .image-empty { min-height: 90px; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; padding: 10px; }
	        </style>
      </head>
      <body>
        <h1>Website Regression Scan Report</h1>
        <div class="meta">
          Site URL: ${escapeHtml(result?.siteUrl ?? "")}<br/>
          Site Name: ${escapeHtml(result?.siteName ?? "")}<br/>
          Scan ID: ${escapeHtml(result?.scanId ?? "N/A")}<br/>
          Generated: ${escapeHtml(new Date().toLocaleString())}
        </div>

        <h2>Scan Summary</h2>
        <div class="grid">
          <div class="card"><div class="label">Pages</div><div class="value">${formatNumber(summary.totalPages)}</div></div>
          <div class="card"><div class="label">New Pages</div><div class="value">${formatNumber(summary.newPages)}</div></div>
          <div class="card"><div class="label">Visual Changes</div><div class="value">${formatNumber(summary.pagesWithVisualChanges)}</div></div>
          <div class="card"><div class="label">DOM Changes</div><div class="value">${formatNumber(summary.pagesWithDomChanges)}</div></div>
	          <div class="card"><div class="label">Max Mismatch %</div><div class="value">${formatNumber(summary.highestVisualMismatch)}</div></div>
	          <div class="card"><div class="label">Overall Status</div><div class="value">${escapeHtml(summary.overallStatus)}</div></div>
	          <div class="card"><div class="label">Smoke Status</div><div class="value">${escapeHtml(functionalSummary.overallStatus ?? "N/A")}</div></div>
	          <div class="card"><div class="label">Broken Links</div><div class="value">${formatNumber(functionalSummary.brokenLinks ?? allBrokenLinks.length)}</div></div>
	          <div class="card"><div class="label">Console Errors</div><div class="value">${formatNumber(functionalSummary.consoleErrors ?? 0)}</div></div>
	        </div>

	        <h2>Detected Issues</h2>
	        ${
	          issueSections ||
	          `<div class="small">No visual, DOM, or functional issues were detected in this scan.</div>`
	        }

	        <h2>Bad and Broken Links</h2>
	        <table>
	          <thead>
	            <tr>
	              <th>Page</th>
	              <th>Broken URL</th>
	              <th>Status</th>
	              <th>Error</th>
	            </tr>
	          </thead>
	          <tbody>
	            ${brokenLinkRows || `<tr><td colspan="4" class="small">No bad or broken links detected.</td></tr>`}
	          </tbody>
	        </table>
	
	        <h2>Page Results</h2>
	        <table>
              <thead>
                <tr>
                  <th>Path</th>
                  <th>URL</th>
                  <th>Visual Status</th>
	                  <th>Mismatch %</th>
	                  <th>DOM Total</th>
	                  <th>DOM Severity</th>
	                  <th>Functional</th>
	                  <th>Broken Links</th>
	                </tr>
	              </thead>
	              <tbody>
	                ${pageRows || `<tr><td colspan="8" class="small">No pages recorded.</td></tr>`}
	              </tbody>
	        </table>

        ${
          code
            ? `
            <h2>GitHub Codebase Changes</h2>
            <div class="meta">
              Repository: ${escapeHtml(code.repositoryUrl)}<br/>
              Branch: ${escapeHtml(code.branch)}<br/>
              Commit: ${escapeHtml(code.currentCommitSha?.slice(0, 7) ?? "")}
            </div>
            <div class="grid">
              <div class="card"><div class="label">Changed Files</div><div class="value">${formatNumber(code.summary?.totalChangedFiles)}</div></div>
              <div class="card"><div class="label">Added</div><div class="value">${formatNumber(code.summary?.added)}</div></div>
              <div class="card"><div class="label">Removed</div><div class="value">${formatNumber(code.summary?.removed)}</div></div>
              <div class="card"><div class="label">Modified</div><div class="value">${formatNumber(code.summary?.modified)}</div></div>
              <div class="card"><div class="label">Renamed</div><div class="value">${formatNumber(code.summary?.renamed)}</div></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Path</th>
                  <th>Additions</th>
                  <th>Deletions</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                ${codeRows || `<tr><td colspan="5" class="small">No code changes detected.</td></tr>`}
              </tbody>
            </table>
          `
            : ""
        }
      </body>
    </html>
  `;
}

export async function generateReportPdf(result) {
  const html = buildReportHtml(result);
  const browser = await launchBrowser();

	  try {
	    const page = await browser.newPage();
	    await page.setContent(html, { waitUntil: "load" });
	    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
	    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
