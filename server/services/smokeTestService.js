import { launchBrowser } from "./browserService.js";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
};

const PAGE_GOTO_TIMEOUT = Number(process.env.SMOKE_PAGE_GOTO_TIMEOUT_MS) || 30000;
const NETWORK_IDLE_TIMEOUT = Number(process.env.SMOKE_NETWORK_IDLE_TIMEOUT_MS) || 10000;
const POST_LOAD_DELAY = Number(process.env.SMOKE_POST_LOAD_DELAY_MS) || 1200;
const BROKEN_LINK_LIMIT = Math.max(1, Number(process.env.SMOKE_BROKEN_LINK_LIMIT) || 20);
const BROKEN_LINK_TIMEOUT = Number(process.env.SMOKE_BROKEN_LINK_TIMEOUT_MS) || 8000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeHref(baseUrl, href) {
  if (!href || typeof href !== "string") {
    return null;
  }

  const trimmed = href.trim();
  if (!trimmed || /^(mailto:|tel:|javascript:|#)/i.test(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeConsoleMessage(message) {
  if (!message) {
    return "";
  }

  return String(message).replace(/\s+/g, " ").trim();
}

function createEmptyFlowResult() {
  return {
    attempted: false,
    passed: true,
    step: null,
    targetUrl: null,
    details: "Flow test not attempted for this page."
  };
}

export function createDefaultSmokeResult(pageUrl = "") {
  return {
    pageUrl,
    responseCode: null,
    loadTimeMs: null,
    testedAt: new Date().toISOString(),
    status: "Healthy",
    coreElements: [],
    missingCoreElements: [],
    consoleErrors: [],
    brokenLinks: [],
    form: {
      available: false,
      count: 0,
      interactiveControlCount: 0
    },
    flow: createEmptyFlowResult(),
    requestFailures: []
  };
}

async function gotoWithRetry(page, url) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT });
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await delay(800 * attempt);
      }
    }
  }

  throw lastError;
}

async function collectBrokenLinks(requestContext, baseUrl, links) {
  const checked = [];
  const sameOrigin = new URL(baseUrl).origin;

  for (const href of links.slice(0, BROKEN_LINK_LIMIT)) {
    const normalized = normalizeHref(baseUrl, href);
    if (!normalized) {
      continue;
    }

    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      continue;
    }

    if (parsed.origin !== sameOrigin) {
      continue;
    }

    try {
      const response = await requestContext.get(normalized, {
        failOnStatusCode: false,
        timeout: BROKEN_LINK_TIMEOUT,
        maxRedirects: 5
      });

      if (response.status() >= 400) {
        checked.push({
          url: normalized,
          statusCode: response.status()
        });
      }
    } catch (error) {
      checked.push({
        url: normalized,
        statusCode: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return checked;
}

async function runContactFlow(page, pageUrl) {
  const result = createEmptyFlowResult();

  let root;
  try {
    root = new URL(pageUrl);
  } catch {
    return result;
  }

  if ((root.pathname.replace(/\/+$/, "") || "/") !== "/") {
    return result;
  }

  const locator = page.locator('a[href*="contact" i], a:has-text("Contact"), a:has-text("Get in touch")').first();
  const count = await locator.count();
  if (!count) {
    return {
      attempted: true,
      passed: false,
      step: "Home -> Contact",
      targetUrl: null,
      details: "No contact-style link was found on the home page."
    };
  }

  const href = await locator.getAttribute("href");
  const targetUrl = normalizeHref(pageUrl, href);

  if (!targetUrl) {
    return {
      attempted: true,
      passed: false,
      step: "Home -> Contact",
      targetUrl: null,
      details: "A contact link was found, but its URL could not be resolved."
    };
  }

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT });
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
    const formCount = await page.locator("form").count();
    const actionCount = await page.locator('button[type="submit"], input[type="submit"], button').count();

    return {
      attempted: true,
      passed: formCount > 0 || actionCount > 0,
      step: "Home -> Contact -> Form visible",
      targetUrl,
      details:
        formCount > 0 || actionCount > 0
          ? "Contact flow opened successfully."
          : "Contact page opened, but no form or submit action was detected."
    };
  } catch (error) {
    return {
      attempted: true,
      passed: false,
      step: "Home -> Contact",
      targetUrl,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function runSmokeTest({
  url,
  viewport = "desktop"
}) {
  const browser = await launchBrowser();
  const result = createDefaultSmokeResult(url);

  try {
    const context = await browser.newContext({
      viewport: VIEWPORTS[viewport] ?? VIEWPORTS.desktop
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const requestFailures = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(normalizeConsoleMessage(message.text()));
      }
    });

    page.on("pageerror", (error) => {
      consoleErrors.push(normalizeConsoleMessage(error?.message || error));
    });

    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        error: request.failure()?.errorText || "Request failed"
      });
    });

    const start = Date.now();
    const response = await gotoWithRetry(page, url);
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(POST_LOAD_DELAY);
    const loadTimeMs = Date.now() - start;

    const coreElements = await page.evaluate(() => {
      const checks = [
        { name: "title", selector: "title" },
        { name: "main", selector: "main, [role='main']" },
        { name: "header", selector: "header, [role='banner'], nav" },
        { name: "footer", selector: "footer, [role='contentinfo']" }
      ];

      return checks.map((entry) => ({
        name: entry.name,
        selector: entry.selector,
        exists: Boolean(document.querySelector(entry.selector))
      }));
    });

    const linkHrefs = await page.locator("a[href]").evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("href"))
        .filter(Boolean)
    );

    const formCount = await page.locator("form").count();
    const interactiveControlCount = await page.locator(
      "form input, form textarea, form select, form button"
    ).count();
    const brokenLinks = await collectBrokenLinks(context.request, url, linkHrefs);
    const flow = await runContactFlow(page, url);

    result.responseCode = response?.status?.() ?? null;
    result.loadTimeMs = loadTimeMs;
    result.coreElements = coreElements;
    result.missingCoreElements = coreElements.filter((entry) => !entry.exists).map((entry) => entry.name);
    result.consoleErrors = consoleErrors.slice(0, 50);
    result.brokenLinks = brokenLinks;
    result.form = {
      available: formCount > 0,
      count: formCount,
      interactiveControlCount
    };
    result.flow = flow;
    result.requestFailures = requestFailures.slice(0, 50);

    const hasFailures =
      (result.responseCode !== null && result.responseCode >= 400) ||
      result.missingCoreElements.length > 0 ||
      result.consoleErrors.length > 0 ||
      result.brokenLinks.length > 0 ||
      result.requestFailures.length > 0 ||
      (result.flow.attempted && !result.flow.passed);

    result.status = hasFailures ? "Failed" : "Healthy";
    return result;
  } catch (error) {
    result.status = "Failed";
    result.consoleErrors = [error instanceof Error ? error.message : String(error)];
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}
